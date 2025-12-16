import { writable, get } from 'svelte/store';
import { VConsoleModel } from '../lib/model';
import * as tool from '../lib/tool';
import { contentStore } from '../core/core.model';
import { VConsoleNetworkRequestItem } from './requestItem';
import { XHRProxy } from './xhr.proxy';
import { FetchProxy } from './fetch.proxy';
import { BeaconProxy } from './beacon.proxy';


/**
 * Network Store
 */
export const requestList = writable<{ [id: string]: VConsoleNetworkRequestItem }>({});


/**
 * Network Model
 */
export class VConsoleNetworkModel extends VConsoleModel {
  public maxNetworkNumber: number = 1000;
  public ignoreUrlRegExp: RegExp = undefined;
  protected itemCounter: number = 0;
  protected resourceObserver: PerformanceObserver = null;

  constructor() {
    super();
    this.mockXHR();
    this.mockFetch();
    this.mockSendBeacon();
    this.mockResources();
  }

  public unMock() {
    // recover original functions
    if (window.hasOwnProperty('XMLHttpRequest')) {
      window.XMLHttpRequest = XHRProxy.origXMLHttpRequest;
    }
    if (window.hasOwnProperty('fetch')) {
      window.fetch = FetchProxy.origFetch;
    }
    if (BeaconProxy.hasSendBeacon()) {
      window.navigator.sendBeacon = BeaconProxy.origSendBeacon;
    }
    // disconnect resource observer
    try {
      if (this.resourceObserver) {
        this.resourceObserver.disconnect();
        this.resourceObserver = null;
      }
    } catch (e) {
      // ignore
    }
  }

  public clearLog() {
    // remove list
    requestList.set({});
  }

  /**
   * Add or update a request item by request ID.
   */
  public updateRequest(id: string, data: VConsoleNetworkRequestItem) {
    const { url } = data;
    if (url && this.ignoreUrlRegExp?.test(url)) {
      return;
    }
    const reqList = get(requestList);
    const hasItem = !!reqList[id];
    if (hasItem) {
      // force re-assign to ensure that the value is updated
      const item = reqList[id];
      for (let key in data) {
        item[key] = data[key];
      }
      data = item;
    }
    requestList.update((reqList) => {
      reqList[id] = data;
      return reqList;
    });
    if (!hasItem) {
      contentStore.updateTime();
      this.limitListLength();
    }
  }

  /**
   * mock XMLHttpRequest
   * @private
   */
  private mockXHR() {
    if (!window.hasOwnProperty('XMLHttpRequest')) {
      return;
    }
    window.XMLHttpRequest = XHRProxy.create((item: VConsoleNetworkRequestItem) => {
      this.updateRequest(item.id, item);
    });
  };

  /**
   * mock fetch request
   * @private
   */
  private mockFetch() {
    if (!window.hasOwnProperty('fetch')) {
      return;
    }
    window.fetch = FetchProxy.create((item: VConsoleNetworkRequestItem) => {
      this.updateRequest(item.id, item);
    });
  }

  /**
   * mock navigator.sendBeacon
   * @private
   */
  private mockSendBeacon() {
    if (!BeaconProxy.hasSendBeacon()) {
      return;
    }
    window.navigator.sendBeacon = BeaconProxy.create((item: VConsoleNetworkRequestItem) => {
      this.updateRequest(item.id, item);
    });
  }

  /**
   * mock resource requests by PerformanceObserver
   */
  private mockResources() {
    if (typeof PerformanceObserver === 'undefined' || typeof performance === 'undefined') {
      return;
    }

    const handleEntry = (entry: PerformanceResourceTiming) => {
      try {
        const item = new VConsoleNetworkRequestItem();
        item.requestType = 'custom';
        item.method = 'GET';
        item.url = entry.name;
        try {
          const url = new URL(entry.name, window.location.href);
          item.name = (url.pathname.split('/').pop() || '') + url.search;
        } catch (e) {
          item.name = entry.name;
        }
        const timeOrigin = (performance as any).timeOrigin || (Date.now() - performance.now());
        item.startTime = Math.round(timeOrigin + entry.startTime);
        item.endTime = Math.round(timeOrigin + entry.responseEnd);
        item.costTime = Math.round(entry.responseEnd - entry.startTime);
        
        // Extract HTTP status code from PerformanceResourceTiming if available
        const responseStatus = (entry as any).responseStatus;
        if (typeof responseStatus === 'number' && responseStatus > 0) {
          // Browser supports responseStatus and it's available
          item.status = responseStatus;
          item.statusText = String(responseStatus);
        } else {
          // Fallback for browsers that don't support responseStatus or when status is unavailable
          item.status = 0;
          item.statusText = 'Resource';
        }
        
        item.readyState = 4;
        // try to get size info
        item.responseSize = (typeof (entry as any).transferSize === 'number' && (entry as any).transferSize > 0)
          ? (entry as any).transferSize
          : ((typeof (entry as any).encodedBodySize === 'number') ? (entry as any).encodedBodySize : 0);
        item.responseSizeText = tool.getBytesText(item.responseSize || 0);
        this.updateRequest(item.id, item);
      } catch (e) {
        // ignore single entry errors
      }
    };

    // observe new resource entries
    try {
      this.resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const e of entries as PerformanceResourceTiming[]) {
          handleEntry(e);
        }
      });
      this.resourceObserver.observe({ type: 'resource', buffered: true });
    } catch (e) {
      this.resourceObserver = null;
    }

    // also dump existing resource entries
    try {
      const existing = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const e of existing) {
        handleEntry(e);
      }
    } catch (e) {
      // ignore
    }
  }

  protected limitListLength() {
    // update list length every N rounds
    const N = 10;
    this.itemCounter++;
    if (this.itemCounter % N !== 0) {
      return;
    }
    this.itemCounter = 0;

    const list = get(requestList);
    const keys = Object.keys(list);
    if (keys.length > this.maxNetworkNumber - N) {
      requestList.update((store) => {
        // delete N more logs for performance
        const deleteKeys = keys.splice(0, keys.length - this.maxNetworkNumber + N);
        for (let i = 0; i < deleteKeys.length; i++) {
          store[deleteKeys[i]] = undefined;
          delete store[deleteKeys[i]];
        }
        return store;
      });
    }
  }

} // END class

export default VConsoleNetworkModel;
