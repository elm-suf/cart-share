import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ListComponent } from './list.component';
import { ListRegistryService } from '../services/list-registry.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let mockListRegistryService: any;
  let mockRoute: any;

  beforeEach(async () => {
    mockListRegistryService = {
      addList: vi.fn(),
      getNickname: vi.fn(),
      setNickname: vi.fn()
    };
    mockRoute = {
      snapshot: { paramMap: { get: () => 'test-token' } }
    };

    // Default to having a nickname
    mockListRegistryService.getNickname.mockReturnValue('Alice');

    await TestBed.configureTestingModule({
      imports: [ListComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ListRegistryService, useValue: mockListRegistryService },
        { provide: ActivatedRoute, useValue: mockRoute }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    
    // Mock the global fetch
    vi.spyOn(window, 'fetch').mockReturnValue(Promise.resolve(new Response(JSON.stringify({
      shareToken: 'test-token',
      name: 'Test List',
      createdAt: 123,
      updatedAt: 123
    }))));
  });

  it('should create and fetch list', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
    expect(window.fetch).toHaveBeenCalledWith('/api/lists/test-token');
  });

  it('should register list upon successful fetch', async () => {
    await fixture.whenStable();
    
    expect(mockListRegistryService.addList).toHaveBeenCalledWith({
      shareToken: 'test-token',
      name: 'Test List',
      isCreator: false, // will be implemented
      joinedAt: expect.any(Number),
      lastAccessedAt: expect.any(Number)
    });
  });

  it('should show nickname prompt if no nickname is set', async () => {
    mockListRegistryService.getNickname.mockReturnValue(null);
    await fixture.whenStable();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.showNicknamePrompt()).toBe(true);
    expect(compiled.querySelector('.nickname-overlay')).toBeTruthy();
  });
  
  it('should not show nickname prompt if nickname is set', async () => {
    mockListRegistryService.getNickname.mockReturnValue('Alice');
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.showNicknamePrompt()).toBe(false);
    expect(compiled.querySelector('.nickname-overlay')).toBeFalsy();
  });
});
