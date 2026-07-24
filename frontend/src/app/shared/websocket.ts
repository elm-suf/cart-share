export interface Item {
  id: string;
  list_id: number;
  name: string;
  quantity?: string;
  checked: boolean;
  position: number;
  updated_at: number;
  editor?: string;
}

export interface WsMessageJoin {
  type: 'join';
  shareToken: string;
}

export interface WsMessageItemAdd {
  type: 'item_add';
  item: Item;
}

export interface WsMessageItemUpdate {
  type: 'item_update';
  item: Item;
}

export interface WsMessageItemDelete {
  type: 'item_delete';
  itemId: string;
}

export interface WsMessageSync {
  type: 'sync';
  items: Item[];
}

export interface WsMessageItemBroadcast {
  type: 'item_broadcast';
  action: 'add' | 'update' | 'delete';
  item?: Item;
  itemId?: string;
}

export interface WsMessageError {
  type: 'error';
  message: string;
}

export type WsMessageClient = WsMessageJoin | WsMessageItemAdd | WsMessageItemUpdate | WsMessageItemDelete;
export type WsMessageServer = WsMessageSync | WsMessageError | WsMessageItemBroadcast;
