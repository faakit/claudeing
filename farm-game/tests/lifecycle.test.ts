import { describe, expect, it, vi } from 'vitest';
import { Lifecycle, installWebLifecycle } from '../src/platform/lifecycle';

describe('Lifecycle', () => {
  it('pause and resume fire once and track state', () => {
    const lc = new Lifecycle();
    const pause = vi.fn();
    const resume = vi.fn();
    lc.on('pause', pause);
    lc.on('resume', resume);
    lc.pause();
    lc.pause(); // duplicate (visibilitychange then pagehide)
    expect(pause).toHaveBeenCalledTimes(1);
    expect(lc.isPaused).toBe(true);
    lc.resume();
    lc.resume();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(lc.isPaused).toBe(false);
  });

  it('resume without a prior pause does nothing', () => {
    const lc = new Lifecycle();
    const resume = vi.fn();
    lc.on('resume', resume);
    lc.resume();
    expect(resume).not.toHaveBeenCalled();
  });

  it('one throwing listener does not stop the others', () => {
    const lc = new Lifecycle();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ok = vi.fn();
    lc.on('pause', () => {
      throw new Error('boom');
    });
    lc.on('pause', ok);
    lc.pause();
    expect(ok).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('back fires every time and listeners can unsubscribe', () => {
    const lc = new Lifecycle();
    const fn = vi.fn();
    const off = lc.on('back', fn);
    lc.back();
    lc.back();
    off();
    lc.back();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('installWebLifecycle', () => {
  function setup() {
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const win = new EventTarget();
    const lc = new Lifecycle();
    installWebLifecycle(lc, doc, win);
    return { doc, win, lc };
  }

  it('hiding the tab pauses and showing it resumes', () => {
    const { doc, lc } = setup();
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(lc.isPaused).toBe(true);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(lc.isPaused).toBe(false);
  });

  it('pagehide pauses even when visibilitychange never fired (iOS)', () => {
    const { win, lc } = setup();
    win.dispatchEvent(new Event('pagehide'));
    expect(lc.isPaused).toBe(true);
  });

  it('pageshow resumes only if the page is actually visible', () => {
    const { doc, win, lc } = setup();
    lc.pause();
    doc.hidden = true;
    win.dispatchEvent(new Event('pageshow'));
    expect(lc.isPaused).toBe(true);
    doc.hidden = false;
    win.dispatchEvent(new Event('pageshow'));
    expect(lc.isPaused).toBe(false);
  });
});
