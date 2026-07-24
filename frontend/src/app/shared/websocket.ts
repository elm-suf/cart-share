export interface Item {
  id: string;
  list_id: number;
  name: string;
  quantity?: string;
  checked: boolean;
  position: number;
  updated_at: number;
}

export interface WsMessageJoin {
  type: 'join';
  shareToken: string;
}

export interface WsMessageSync {
  type: 'sync';
  items: Item[];
}

export interface WsMessageError {
  type: 'error';
  message: string;
}

export type WsMessageClient = WsMessageJoin;
export type WsMessageServer = WsMessageSync | WsMessageError;
