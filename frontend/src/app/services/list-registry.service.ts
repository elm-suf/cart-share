import { Injectable } from '@angular/core';

export interface ListRegistryEntry {
  shareToken: string;
  name: string;
  isCreator: boolean;
  joinedAt: number;
  lastAccessedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class ListRegistryService {
  private readonly REGISTRY_KEY = 'listRegistry';
  private readonly NICKNAME_KEY = 'nickname';

  constructor() { }

  getLists(): ListRegistryEntry[] {
    const raw = localStorage.getItem(this.REGISTRY_KEY);
    if (!raw) return [];
    try {
      const lists: ListRegistryEntry[] = JSON.parse(raw);
      return lists.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
    } catch {
      return [];
    }
  }

  addList(entry: ListRegistryEntry): void {
    const lists = this.getLists();
    const existingIndex = lists.findIndex(l => l.shareToken === entry.shareToken);
    
    if (existingIndex >= 0) {
      lists[existingIndex] = { ...lists[existingIndex], ...entry };
    } else {
      lists.push(entry);
    }
    
    localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(lists));
  }

  getNickname(): string | null {
    return localStorage.getItem(this.NICKNAME_KEY);
  }

  setNickname(name: string): void {
    localStorage.setItem(this.NICKNAME_KEY, name);
  }
}
