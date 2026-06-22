// ─────────────────────────────────────────────────────────────
//  LAYER REGISTRY — the plugin API (plan §3.2)
//
//  A layer module is a default export:
//    {
//      id, label, group: 'surface' | 'entanglement',
//      methodologyPath, dataPath,           // dataPath optional
//      controls: [{ id, label, type, default, min?, max?, step? }],
//      render(ctx) -> { update?(), destroy?() } | cleanupFn | void
//    }
//
//  ctx (built per-layer, handed to render):
//    globe          the GlobeEngine api
//    svg            d3 selection of the root <svg>
//    group          a private <g> inside the globe overlay for this layer
//    projection,path d3 projection + geoPath (shared, reprojected each frame)
//    getCentroids() { iso3: [lon,lat] }
//    setPaint(fn)   surface layers only — fn(iso3)->css colour
//    data           the layer's loaded JSON (via dataPath), or null
//    getControl(id) current value of a declared control
//    getYear()      current global year
//    onRender(fn)   subscribe to every frame (reproject arcs here); auto-unsub on destroy
//    requestRender()/requestRepaint()
//
//  Grouping rule: 'surface' layers are mutually exclusive (radio — only one
//  choropleth fill can show). 'entanglement' layers stack freely (checkboxes).
// ─────────────────────────────────────────────────────────────

import { loadJSON } from './data-loader.js';
import { colorFor, legendGradient } from './theme.js';

export class LayerRegistry {
  constructor(globe, { defaultYear = 2024 } = {}) {
    this.globe = globe;
    this.year = defaultYear;
    // When true, year-aware layers ignore the year and show ALL years at once
    // (the global time scrubber's "All time" off-switch). Layers read it via
    // ctx.isAllTime().
    this.allTime = false;
    this.entries = new Map();      // id -> entry
    this._changeListeners = new Set();
    this._yearListeners = new Set();
  }

  register(module) {
    if (!module || !module.id) throw new Error('layer module needs an id');
    if (this.entries.has(module.id)) { console.warn(`layer ${module.id} already registered`); return; }
    const controlValues = {};
    (module.controls || []).forEach((c) => { controlValues[c.id] = c.default; });
    this.entries.set(module.id, {
      module, visible: false, mounted: null, data: null, ctx: null, controlValues,
    });
    this._emitChange();
    return this;
  }

  list() { return [...this.entries.values()].map((e) => this._publicEntry(e)); }
  get(id) { const e = this.entries.get(id); return e ? this._publicEntry(e) : null; }

  _publicEntry(e) {
    return {
      id: e.module.id, label: e.module.label, group: e.module.group || 'entanglement',
      methodologyPath: e.module.methodologyPath, controls: e.module.controls || [],
      visible: e.visible, controlValues: { ...e.controlValues },
      beta: !!e.module.beta, passcode: e.module.passcode || null,
    };
  }

  // subscribe to registry changes (layer added / visibility / controls) — for the panel UI
  onChange(fn) { this._changeListeners.add(fn); return () => this._changeListeners.delete(fn); }
  _emitChange() { this._changeListeners.forEach((fn) => { try { fn(this.list()); } catch (e) { console.warn(e); } }); }

  async setVisible(id, on) {
    const e = this.entries.get(id);
    if (!e || e.visible === on) return;
    if (on && (e.module.group || 'entanglement') === 'surface') {
      // radio behaviour within the surface group
      for (const other of this.entries.values()) {
        if (other !== e && (other.module.group || 'entanglement') === 'surface' && other.visible) {
          await this._unmount(other);
        }
      }
    }
    if (on) await this._mount(e); else await this._unmount(e);
    this._emitChange();
  }

  async _mount(e) {
    try {
      if (e.module.dataPath && e.data == null) e.data = await loadJSON(e.module.dataPath);
    } catch (err) {
      console.error(`layer ${e.module.id}: data load failed`, err);
      e.data = null;
    }
    const ctx = this._buildCtx(e);
    e.ctx = ctx;
    const result = e.module.render(ctx);
    e.mounted = typeof result === 'function' ? { destroy: result } : (result || {});
    e.visible = true;
  }

  async _unmount(e) {
    if (e.mounted?.destroy) { try { e.mounted.destroy(); } catch (err) { console.warn(err); } }
    if (e.ctx?._teardown) e.ctx._teardown();
    e.mounted = null; e.ctx = null; e.visible = false;
  }

  _buildCtx(e) {
    const globe = this.globe;
    const group = globe.overlay.append('g').attr('data-layer', e.module.id);
    const unsubs = [];
    return {
      globe, svg: globe.svg, group,
      projection: globe.projection, path: globe.path,
      getCentroids: () => globe.getCentroids(),
      setPaint: (fn) => globe.setPaint(fn),
      data: e.data,
      getControl: (cid) => e.controlValues[cid],
      getYear: () => this.year,
      isAllTime: () => this.allTime,
      onRender: (fn) => { const u = globe.onRender(fn); unsubs.push(u); return u; },
      requestRender: () => globe.requestRender(),
      requestRepaint: () => globe.repaint(),
      colorFor, legendGradient,
      _teardown: () => { unsubs.forEach((u) => u()); group.remove(); },
    };
  }

  setControl(id, controlId, value) {
    const e = this.entries.get(id);
    if (!e) return;
    e.controlValues[controlId] = value;
    if (e.mounted?.update) { try { e.mounted.update({ controls: e.controlValues, year: this.year }); } catch (err) { console.warn(err); } }
    else this.globe.requestRender();
    this._emitChange();
  }

  setYear(y) {
    this.year = y;
    for (const e of this.entries.values()) {
      if (e.visible && e.mounted?.update) { try { e.mounted.update({ controls: e.controlValues, year: y }); } catch (err) { console.warn(err); } }
    }
    this.globe.requestRender();
    this._yearListeners.forEach((fn) => { try { fn(y); } catch (e) { console.warn(e); } });
  }
  onYearChange(fn) { this._yearListeners.add(fn); return () => this._yearListeners.delete(fn); }

  // Toggle the global "all time" mode. Year-aware layers read ctx.isAllTime()
  // each frame and, when on, show the union of all years instead of one year.
  setAllTime(on) {
    this.allTime = !!on;
    for (const e of this.entries.values()) {
      if (e.visible && e.mounted?.update) {
        try { e.mounted.update({ controls: e.controlValues, year: this.year, allTime: this.allTime }); }
        catch (err) { console.warn(err); }
      }
    }
    this.globe.requestRender();
    this._emitChange();
  }
}
