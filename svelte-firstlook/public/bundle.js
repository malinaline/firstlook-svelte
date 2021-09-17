
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        if (component.$$.props.indexOf(name) === -1)
            return;
        component.$$.bound[name] = callback;
        callback(component.$$.ctx[name]);
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/ArtistList.svelte generated by Svelte v3.12.1 */

    const file = "src/ArtistList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.name = list[i].name;
    	child_ctx.src = list[i].src;
    	child_ctx.reknown = list[i].reknown;
    	return child_ctx;
    }

    // (30:6) {:else}
    function create_else_block(ctx) {
    	var p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "No data";
    			attr_dev(p, "class", "svelte-19vrhdb");
    			add_location(p, file, 30, 8, 668);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(p);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_else_block.name, type: "else", source: "(30:6) {:else}", ctx });
    	return block;
    }

    // (20:6) {#each artists as { name, src, reknown }}
    function create_each_block(ctx) {
    	var div1, img, img_src_value, img_alt_value, t0, div0, h4, t1_value = ctx.name + "", t1, t2, p, t3_value = ctx.reknown + "", t3, t4;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h4 = element("h4");
    			t1 = text(t1_value);
    			t2 = space();
    			p = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			attr_dev(img, "class", "rounded mr-3 d-block svelte-19vrhdb");
    			attr_dev(img, "src", img_src_value = ctx.src);
    			attr_dev(img, "alt", img_alt_value = `Photo of ${ctx.name}`);
    			add_location(img, file, 23, 10, 436);
    			attr_dev(h4, "class", "mb-0 svelte-19vrhdb");
    			add_location(h4, file, 25, 12, 532);
    			attr_dev(p, "class", "text-muted mb-0 svelte-19vrhdb");
    			add_location(p, file, 26, 12, 573);
    			add_location(div0, file, 24, 10, 514);
    			attr_dev(div1, "class", "list-group-item d-flex w-100 list-group-item-action\n          align-items-center");
    			add_location(div1, file, 20, 8, 321);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, h4);
    			append_dev(h4, t1);
    			append_dev(div0, t2);
    			append_dev(div0, p);
    			append_dev(p, t3);
    			append_dev(div1, t4);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.artists) && img_src_value !== (img_src_value = ctx.src)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if ((changed.artists) && img_alt_value !== (img_alt_value = `Photo of ${ctx.name}`)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((changed.artists) && t1_value !== (t1_value = ctx.name + "")) {
    				set_data_dev(t1, t1_value);
    			}

    			if ((changed.artists) && t3_value !== (t3_value = ctx.reknown + "")) {
    				set_data_dev(t3, t3_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_each_block.name, type: "each", source: "(20:6) {#each artists as { name, src, reknown }}", ctx });
    	return block;
    }

    function create_fragment(ctx) {
    	var div2, div1, div0;

    	let each_value = ctx.artists;

    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    		each_1_else.c();
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}
    			attr_dev(div0, "class", "list-group");
    			add_location(div0, file, 18, 4, 240);
    			attr_dev(div1, "class", "col-11 col-md-7 col-lg-5");
    			add_location(div1, file, 17, 2, 197);
    			attr_dev(div2, "class", "row justify-content-center");
    			add_location(div2, file, 16, 0, 154);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div0, null);
    			}
    		},

    		p: function update(changed, ctx) {
    			if (changed.artists) {
    				each_value = ctx.artists;

    				let i;
    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (each_value.length) {
    				if (each_1_else) {
    					each_1_else.d(1);
    					each_1_else = null;
    				}
    			} else if (!each_1_else) {
    				each_1_else = create_else_block(ctx);
    				each_1_else.c();
    				each_1_else.m(div0, null);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div2);
    			}

    			destroy_each(each_blocks, detaching);

    			if (each_1_else) each_1_else.d();
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { artists } = $$props;

    	const writable_props = ['artists'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<ArtistList> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('artists' in $$props) $$invalidate('artists', artists = $$props.artists);
    	};

    	$$self.$capture_state = () => {
    		return { artists };
    	};

    	$$self.$inject_state = $$props => {
    		if ('artists' in $$props) $$invalidate('artists', artists = $$props.artists);
    	};

    	return { artists };
    }

    class ArtistList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["artists"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "ArtistList", options, id: create_fragment.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.artists === undefined && !('artists' in props)) {
    			console.warn("<ArtistList> was created without expected prop 'artists'");
    		}
    	}

    	get artists() {
    		throw new Error("<ArtistList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set artists(value) {
    		throw new Error("<ArtistList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ArtistSearch.svelte generated by Svelte v3.12.1 */

    const file$1 = "src/ArtistSearch.svelte";

    // (11:15) {#if searchTerm}
    function create_if_block(ctx) {
    	var t;

    	const block = {
    		c: function create() {
    			t = text("for");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(t);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(11:15) {#if searchTerm}", ctx });
    	return block;
    }

    function create_fragment$1(ctx) {
    	var div2, div1, h4, t0, small, t1, t2, t3, div0, input, dispose;

    	var if_block = (ctx.searchTerm) && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			h4 = element("h4");
    			t0 = text("Search:\n        ");
    			small = element("small");
    			if (if_block) if_block.c();
    			t1 = space();
    			t2 = text(ctx.searchTerm);
    			t3 = space();
    			div0 = element("div");
    			input = element("input");
    			add_location(small, file$1, 10, 8, 308);
    			attr_dev(h4, "class", "mb-1");
    			add_location(h4, file$1, 8, 6, 266);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "aria-label", "Search Input");
    			add_location(input, file$1, 15, 8, 434);
    			attr_dev(div0, "class", "input-group");
    			add_location(div0, file$1, 14, 6, 400);
    			attr_dev(div1, "class", "col-12 col-md-8 col-lg-6 border rounded bg-light p-3");
    			add_location(div1, file$1, 7, 4, 193);
    			attr_dev(div2, "class", "row justify-content-center mt-2");
    			add_location(div2, file$1, 6, 0, 143);

    			dispose = [
    				listen_dev(input, "input", ctx.input_input_handler),
    				listen_dev(input, "keyup", ctx.keyup_handler)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, h4);
    			append_dev(h4, t0);
    			append_dev(h4, small);
    			if (if_block) if_block.m(small, null);
    			append_dev(small, t1);
    			append_dev(small, t2);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, input);

    			set_input_value(input, ctx.searchTerm);
    		},

    		p: function update(changed, ctx) {
    			if (ctx.searchTerm) {
    				if (!if_block) {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(small, t1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (changed.searchTerm) {
    				set_data_dev(t2, ctx.searchTerm);
    			}

    			if (changed.searchTerm && (input.value !== ctx.searchTerm)) set_input_value(input, ctx.searchTerm);
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div2);
    			}

    			if (if_block) if_block.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
        let { searchTerm } = $$props;

    	const writable_props = ['searchTerm'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<ArtistSearch> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		searchTerm = this.value;
    		$$invalidate('searchTerm', searchTerm);
    	}

    	const keyup_handler = () => {
    	            dispatch('updateSearch');
    	          };

    	$$self.$set = $$props => {
    		if ('searchTerm' in $$props) $$invalidate('searchTerm', searchTerm = $$props.searchTerm);
    	};

    	$$self.$capture_state = () => {
    		return { searchTerm };
    	};

    	$$self.$inject_state = $$props => {
    		if ('searchTerm' in $$props) $$invalidate('searchTerm', searchTerm = $$props.searchTerm);
    	};

    	return {
    		dispatch,
    		searchTerm,
    		input_input_handler,
    		keyup_handler
    	};
    }

    class ArtistSearch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["searchTerm"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "ArtistSearch", options, id: create_fragment$1.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.searchTerm === undefined && !('searchTerm' in props)) {
    			console.warn("<ArtistSearch> was created without expected prop 'searchTerm'");
    		}
    	}

    	get searchTerm() {
    		throw new Error("<ArtistSearch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set searchTerm(value) {
    		throw new Error("<ArtistSearch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.12.1 */

    const file$2 = "src/App.svelte";

    function create_fragment$2(ctx) {
    	var div, updating_searchTerm, t, updating_artists, current;

    	function artistsearch_searchTerm_binding(value) {
    		ctx.artistsearch_searchTerm_binding.call(null, value);
    		updating_searchTerm = true;
    		add_flush_callback(() => updating_searchTerm = false);
    	}

    	let artistsearch_props = {};
    	if (ctx.searchTerm !== void 0) {
    		artistsearch_props.searchTerm = ctx.searchTerm;
    	}
    	var artistsearch = new ArtistSearch({
    		props: artistsearch_props,
    		$$inline: true
    	});

    	binding_callbacks.push(() => bind(artistsearch, 'searchTerm', artistsearch_searchTerm_binding));
    	artistsearch.$on("updateSearch", ctx.updateSearch_handler);

    	function artistlist_artists_binding(value_1) {
    		ctx.artistlist_artists_binding.call(null, value_1);
    		updating_artists = true;
    		add_flush_callback(() => updating_artists = false);
    	}

    	let artistlist_props = {};
    	if (ctx.displayList !== void 0) {
    		artistlist_props.artists = ctx.displayList;
    	}
    	var artistlist = new ArtistList({ props: artistlist_props, $$inline: true });

    	binding_callbacks.push(() => bind(artistlist, 'artists', artistlist_artists_binding));

    	const block = {
    		c: function create() {
    			div = element("div");
    			artistsearch.$$.fragment.c();
    			t = space();
    			artistlist.$$.fragment.c();
    			attr_dev(div, "class", "container");
    			add_location(div, file$2, 7907, 0, 234715);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(artistsearch, div, null);
    			append_dev(div, t);
    			mount_component(artistlist, div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var artistsearch_changes = {};
    			if (!updating_searchTerm && changed.searchTerm) {
    				artistsearch_changes.searchTerm = ctx.searchTerm;
    			}
    			artistsearch.$set(artistsearch_changes);

    			var artistlist_changes = {};
    			if (!updating_artists && changed.displayList) {
    				artistlist_changes.artists = ctx.displayList;
    			}
    			artistlist.$set(artistlist_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(artistsearch.$$.fragment, local);

    			transition_in(artistlist.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(artistsearch.$$.fragment, local);
    			transition_out(artistlist.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_component(artistsearch);

    			destroy_component(artistlist);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    function filterList(list, query) {
      return list.filter(item => {
        return (
          item.name.toLowerCase().match(query.toLowerCase()) ||
          item.bio.toLowerCase().match(query.toLowerCase())
        );
      });
    }

    function instance$2($$self, $$props, $$invalidate) {
    	
      let searchTerm = "";
      let artists = [];
      let displayList = [];
      onMount(async () => {
        const res = await fetch(`data.json`);
        $$invalidate('artists', artists = await res.json());
        $$invalidate('displayList', displayList = artists);
      });

    	function artistsearch_searchTerm_binding(value) {
    		searchTerm = value;
    		$$invalidate('searchTerm', searchTerm);
    	}

    	const updateSearch_handler = () => {
    	      $$invalidate('displayList', displayList = filterList(artists, searchTerm));
    	    };

    	function artistlist_artists_binding(value_1) {
    		displayList = value_1;
    		$$invalidate('displayList', displayList);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('searchTerm' in $$props) $$invalidate('searchTerm', searchTerm = $$props.searchTerm);
    		if ('artists' in $$props) $$invalidate('artists', artists = $$props.artists);
    		if ('displayList' in $$props) $$invalidate('displayList', displayList = $$props.displayList);
    	};

    	return {
    		searchTerm,
    		artists,
    		displayList,
    		artistsearch_searchTerm_binding,
    		updateSearch_handler,
    		artistlist_artists_binding
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "App", options, id: create_fragment$2.name });
    	}
    }

    const app = new App({
    	target: document.body,

    	
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
