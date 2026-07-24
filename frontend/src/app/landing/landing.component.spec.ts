import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LandingComponent } from './landing.component';
import { ListRegistryService } from '../services/list-registry.service';
import { Router } from '@angular/router';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let mockListRegistryService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockListRegistryService = { getLists: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    // Default to no lists
    mockListRegistryService.getLists.mockReturnValue([]);

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ListRegistryService, useValue: mockListRegistryService },
        { provide: Router, useValue: mockRouter }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
  });

  it('should create', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('should show landing page when no lists exist', async () => {
    mockListRegistryService.getLists.mockReturnValue([]);
    await fixture.whenStable();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.intro-section')).toBeTruthy(); // default feature card
    expect(compiled.querySelector('.dashboard-section')).toBeFalsy(); // no dashboard
  });

  it('should show dashboard when lists exist', async () => {
    mockListRegistryService.getLists.mockReturnValue([
      { shareToken: 'tok1', name: 'List 1', isCreator: true, joinedAt: 123, lastAccessedAt: 123 }
    ]);
    await fixture.whenStable();
    
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.intro-section')).toBeFalsy(); // no default landing
    expect(compiled.querySelector('.dashboard-section')).toBeTruthy(); // should show dashboard
    expect(compiled.textContent).toContain('List 1');
  });
});
