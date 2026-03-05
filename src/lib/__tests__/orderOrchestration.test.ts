import { describe, it, expect } from 'vitest';
import {
  buildProvisioningGraph,
  detectServiceCategories,
  SERVICE_DEPENDENCIES,
} from '../orderOrchestration.pure';

describe('detectServiceCategories', () => {
  it('detects internet from service string', () => {
    expect(detectServiceCategories('Internet 100')).toEqual(['internet']);
  });

  it('detects tv from service string', () => {
    expect(detectServiceCategories('Télé HD')).toEqual(['tv']);
  });

  it('detects mobile from service string', () => {
    expect(detectServiceCategories('Mobile 5GB')).toEqual(['mobile']);
  });

  it('detects bundle (internet + tv + mobile)', () => {
    const result = detectServiceCategories('Internet 100, Télé HD, Mobile 5GB');
    expect(result).toContain('internet');
    expect(result).toContain('tv');
    expect(result).toContain('mobile');
  });

  it('detects streaming', () => {
    expect(detectServiceCategories('Streaming+')).toEqual(['streaming']);
  });

  it('returns empty for unknown', () => {
    expect(detectServiceCategories('some random thing')).toEqual([]);
  });
});

describe('buildProvisioningGraph', () => {
  it('creates single internet job', () => {
    const graph = buildProvisioningGraph(['internet']);
    expect(graph).toHaveLength(1);
    expect(graph[0].jobType).toBe('INTERNET_ACTIVATE');
    expect(graph[0].dependsOn).toBeNull();
  });

  it('creates single mobile job (fast path)', () => {
    const graph = buildProvisioningGraph(['mobile']);
    expect(graph).toHaveLength(1);
    expect(graph[0].jobType).toBe('MOBILE_ACTIVATE');
    expect(graph[0].priority).toBe(5);
  });

  it('creates TV jobs with no internet dependency when standalone', () => {
    const graph = buildProvisioningGraph(['tv']);
    expect(graph).toHaveLength(2);
    const tvActivate = graph.find(n => n.jobType === 'TV_ACTIVATE')!;
    const channelPush = graph.find(n => n.jobType === 'CHANNEL_PUSH')!;
    expect(tvActivate.dependsOn).toBeNull();
    expect(channelPush.dependsOn).toBe('TV_ACTIVATE');
  });

  it('creates TV+Internet bundle with dependency', () => {
    const graph = buildProvisioningGraph(['internet', 'tv']);
    expect(graph.length).toBeGreaterThanOrEqual(3);
    
    const internet = graph.find(n => n.jobType === 'INTERNET_ACTIVATE')!;
    const tv = graph.find(n => n.jobType === 'TV_ACTIVATE')!;
    const channels = graph.find(n => n.jobType === 'CHANNEL_PUSH')!;
    
    expect(internet.dependsOn).toBeNull();
    expect(tv.dependsOn).toBe('INTERNET_ACTIVATE');
    expect(channels.dependsOn).toBe('TV_ACTIVATE');
  });

  it('creates triple-play graph with correct dependencies', () => {
    const graph = buildProvisioningGraph(['internet', 'tv', 'mobile']);
    
    const mobile = graph.find(n => n.jobType === 'MOBILE_ACTIVATE')!;
    const internet = graph.find(n => n.jobType === 'INTERNET_ACTIVATE')!;
    const tv = graph.find(n => n.jobType === 'TV_ACTIVATE')!;
    
    expect(mobile.dependsOn).toBeNull();
    expect(mobile.priority).toBeLessThan(internet.priority);
    expect(tv.dependsOn).toBe('INTERNET_ACTIVATE');
  });

  it('adds PORT_IN when hasPortIn is true', () => {
    const graph = buildProvisioningGraph(['mobile'], true);
    expect(graph).toHaveLength(2);
    
    const portIn = graph.find(n => n.jobType === 'PORT_IN')!;
    expect(portIn).toBeDefined();
    expect(portIn.dependsOn).toBe('MOBILE_ACTIVATE');
  });

  it('does not add PORT_IN when no mobile service', () => {
    const graph = buildProvisioningGraph(['internet'], true);
    expect(graph.find(n => n.jobType === 'PORT_IN')).toBeUndefined();
  });

  it('sorts by priority (mobile first)', () => {
    const graph = buildProvisioningGraph(['internet', 'tv', 'mobile']);
    expect(graph[0].jobType).toBe('MOBILE_ACTIVATE');
    expect(graph[1].jobType).toBe('INTERNET_ACTIVATE');
  });

  it('handles security with internet dependency', () => {
    const graph = buildProvisioningGraph(['internet', 'security']);
    const security = graph.find(n => n.jobType === 'SECURITY_ACTIVATE')!;
    expect(security.dependsOn).toBe('INTERNET_ACTIVATE');
  });
});

describe('SERVICE_DEPENDENCIES', () => {
  it('has internet → tv dependency', () => {
    const dep = SERVICE_DEPENDENCIES.find(d => d.from === 'internet' && d.to === 'tv');
    expect(dep).toBeDefined();
  });
});
