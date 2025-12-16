<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as tool from '../lib/tool';
  import IconCopy from '../component/icon/iconCopy.svelte';
  import Icon from '../component/icon/icon.svelte';
  import { requestList } from './network.model';
  import Style from './network.less';
  import RecycleScroller from '../component/recycleScroller/recycleScroller.svelte';
  import type { VConsoleNetworkRequestItem } from './requestItem';
  import type { IVConsoleTabOptions } from "../lib/plugin";

  let reqCount = 0;
  const updateReqCount = (list: typeof $requestList) => {
    reqCount = Object.keys(list).length;
  };
  const unsubscribe = requestList.subscribe(updateReqCount);
  updateReqCount($requestList);

  export const options: IVConsoleTabOptions = {
    fixedHeight: true,
  };

  let reqList = [];
  let filterText = '';

  $: {
    // 根据过滤文本筛选请求列表
    const allReqs = Object.values($requestList);
    if (filterText === '') {
      reqList = allReqs;
    } else {
      const filterLower = filterText.toLowerCase();
      reqList = allReqs.filter((req: VConsoleNetworkRequestItem) => {
        return req.name?.toLowerCase().includes(filterLower) || 
               req.url?.toLowerCase().includes(filterLower);
      });
    }
  }

  const onTapPreview = (reqId: string) => {
    $requestList[reqId].actived = !$requestList[reqId].actived;
  };
  const onCopyCurl = (req: VConsoleNetworkRequestItem) => {
    let curl = `curl -X ${req.method}`;
    if (typeof req.postData === 'string') {
      curl += ` -d '${req.postData}'`;
    } else if (typeof req.postData === 'object' && req.postData !== null) {
      curl += ` -d '${tool.safeJSONStringify(req.postData)}'`;
    }
    return `${curl} '${req.url}'`;
  };

  const onTapClearFilter = () => {
    filterText = '';
  };

  onMount(() => {
    Style.use();
  });

  onDestroy(() => {
    unsubscribe();
    Style.unuse();
  });

  const prettyStringify = (value: any) => {
    if (tool.isObject(value) || tool.isArray(value)) {
      return tool.safeJSONStringify(value, { maxDepth: 10, keyMaxLen: 10000, pretty: true });
    }
    return value;
  };
</script>

<div class="vc-table">

  <div class="vc-plugin-content vc-network-content">
    <RecycleScroller
      items={reqList}
      itemKey="id"
      itemHeight={30}
      buffer={100}
      stickToBottom
      scrollbar
    >
    
      <svelte:fragment slot="header">
        <dl class="vc-table-row">
          <dd class="vc-table-col vc-table-col-4">Name {#if reqCount > 0}({reqList.length}/{reqCount}){/if}</dd>
          <dd class="vc-table-col">Method</dd>
          <dd class="vc-table-col">Status</dd>
          <dd class="vc-table-col">Time</dd>
        </dl>
      </svelte:fragment>
      
      <div slot="empty" class="vc-plugin-empty">Empty</div>

      <div slot="item" let:item={req} class="vc-group" class:vc-actived="{req.actived}" id="{req.id}">
        <dl class="vc-table-row vc-group-preview" class:vc-table-row-error="{req.status >= 400}" on:click={() => onTapPreview(req.id)}>
          <dd class="vc-table-col vc-table-col-4">{req.name}</dd>
          <dd class="vc-table-col">{req.method}</dd>
          <dd class="vc-table-col">{req.statusText}</dd>
          <dd class="vc-table-col">{req.costTime}</dd>
        </dl>
        <div class="vc-group-detail">
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                General
                <i class="vc-table-row-icon"><IconCopy handler={onCopyCurl} content={req} /></i>
              </dt>
            </dl>
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">URL</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.url}</div>
            </div>
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">Method</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.method}</div>
            </div>
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">Request Type</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.requestType}</div>
            </div>
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">HTTP Status</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.status}</div>
            </div>
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">Start Time</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.startTimeText}</div>
            </div>
          </div>
          {#if (req.requestHeader !== null)}
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                Request Headers
                <i class="vc-table-row-icon"><IconCopy content={req.requestHeader} /></i>
              </dt>
            </dl>
            {#each Object.entries(req.requestHeader) as [key, item]}
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">{key}</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{prettyStringify(item)}</div>
            </div>
            {/each}
          </div>
          {/if}
          {#if (req.getData !== null)}
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                Query String Parameters
                <i class="vc-table-row-icon"><IconCopy content={req.getData} /></i>
              </dt>
            </dl>
            {#each Object.entries(req.getData) as [key, item]}
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">{key}</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{prettyStringify(item)}</div>
            </div>
            {/each}
          </div>
          {/if}
          {#if (req.postData !== null)}
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                Request Payload
                <i class="vc-table-row-icon"><IconCopy content={req.postData} /></i>
              </dt>
            </dl>
            {#if (typeof req.postData === 'string')}
              <div class="vc-table-row vc-left-border vc-small">
                <pre
                  class="vc-table-col vc-table-col-value vc-max-height-line"
                  data-scrollable="1"
                >{req.postData}</pre>
              </div>
            {:else}
              {#each Object.entries(req.postData) as [key, item]}
              <div class="vc-table-row vc-left-border vc-small">
                <div class="vc-table-col vc-table-col-2">{key}</div>
                <div
                  class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line"
                  data-scrollable="1"
                >{prettyStringify(item)}</div>
              </div>
              {/each}
            {/if}
          </div>
          {/if}
          {#if (req.header !== null)}
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                Response Headers
                <i class="vc-table-row-icon"><IconCopy content={req.header} /></i>
              </dt>
            </dl>
            {#each Object.entries(req.header) as [key, item]}
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">{key}</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{prettyStringify(item)}</div>
            </div>
            {/each}
          </div>
          {/if}
          <div>
            <dl class="vc-table-row vc-left-border">
              <dt class="vc-table-col vc-table-col-title">
                Response
                <i class="vc-table-row-icon"><IconCopy content={req.response} /></i>
              </dt>
            </dl>
            {#if (req.responseSize > 0)}
            <div class="vc-table-row vc-left-border vc-small">
              <div class="vc-table-col vc-table-col-2">Size</div>
              <div class="vc-table-col vc-table-col-4 vc-table-col-value vc-max-height-line">{req.responseSizeText}</div>
            </div>
            {/if}
            <div class="vc-table-row vc-left-border vc-small">
              <pre
                class="vc-table-col vc-max-height vc-min-height"
                data-scrollable="1"
              >{req.response || ''}</pre>
            </div>
          </div>
        </div>
      </div>

      <svelte:fragment slot="footer">
        <form class="vc-cmd vc-network-filter" on:submit|preventDefault>
          <div class="vc-cmd-input-wrap">
            <textarea
              class="vc-cmd-input"
              placeholder="Filter by name or url..."
              bind:value={filterText}
            ></textarea>
            {#if filterText.length > 0}
              <div class="vc-cmd-clear-btn" on:click={onTapClearFilter}>
                <Icon name="clear" />
              </div>
            {/if}
          </div>
        </form>
      </svelte:fragment>
    </RecycleScroller>
  </div>
</div>

<style>
  .vc-network-content {
    padding-bottom: 0;
  }
  
  .vc-network-filter {
    position: sticky;
    bottom: 0;
    background-color: var(--VC-BG-0);
    z-index: 1;
  }
</style>