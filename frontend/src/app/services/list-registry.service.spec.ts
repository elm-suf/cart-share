import { TestBed } from '@angular/core/testing';
import { ListRegistryService, ListRegistryEntry } from './list-registry.service';

describe('ListRegistryService', () => {
  let service: ListRegistryService;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ListRegistryService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Lists', () => {
    it('should return empty array if no lists in localStorage', () => {
      expect(service.getLists()).toEqual([]);
    });

    it('should add a list and return it', () => {
      const entry: ListRegistryEntry = {
        shareToken: 'test-token',
        name: 'My Groceries',
        isCreator: true,
        joinedAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      
      service.addList(entry);
      
      const lists = service.getLists();
      expect(lists.length).toBe(1);
      expect(lists[0].shareToken).toBe('test-token');
      expect(lists[0].name).toBe('My Groceries');
    });

    it('should update an existing list instead of duplicating', () => {
      const entry1: ListRegistryEntry = {
        shareToken: 'test-token',
        name: 'My Groceries',
        isCreator: true,
        joinedAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      
      service.addList(entry1);
      
      const entry2: ListRegistryEntry = {
        ...entry1,
        name: 'Updated Groceries',
        lastAccessedAt: Date.now() + 1000
      };

      service.addList(entry2);

      const lists = service.getLists();
      expect(lists.length).toBe(1);
      expect(lists[0].name).toBe('Updated Groceries');
    });

    it('should sort lists by lastAccessedAt descending', () => {
      service.addList({
        shareToken: 'older',
        name: 'Older',
        isCreator: false,
        joinedAt: Date.now(),
        lastAccessedAt: Date.now() - 10000
      });
      service.addList({
        shareToken: 'newer',
        name: 'Newer',
        isCreator: false,
        joinedAt: Date.now(),
        lastAccessedAt: Date.now()
      });

      const lists = service.getLists();
      expect(lists[0].shareToken).toBe('newer');
      expect(lists[1].shareToken).toBe('older');
    });
  });

  describe('Nickname', () => {
    it('should return null if no nickname is set', () => {
      expect(service.getNickname()).toBeNull();
    });

    it('should set and get the nickname', () => {
      service.setNickname('Alice');
      expect(service.getNickname()).toBe('Alice');
    });
  });
});
