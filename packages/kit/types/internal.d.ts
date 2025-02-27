import { SvelteComponent } from 'svelte/internal';
import {
	Config,
	ServerLoad,
	Handle,
	HandleServerError,
	KitConfig,
	Load,
	RequestHandler,
	ResolveOptions,
	Server,
	ServerInitOptions,
	SSRManifest,
	HandleFetch,
	Actions,
	HandleClientError
} from './index.js';
import {
	HttpMethod,
	MaybePromise,
	PrerenderOption,
	RequestOptions,
	TrailingSlash
} from './private.js';

export interface ServerModule {
	Server: typeof InternalServer;
}

export interface ServerInternalModule {
	set_building(building: boolean): void;
	set_assets(path: string): void;
	set_private_env(environment: Record<string, string>): void;
	set_public_env(environment: Record<string, string>): void;
	set_version(version: string): void;
	set_fix_stack_trace(fix_stack_trace: (stack: string) => string): void;
}

export interface Asset {
	file: string;
	size: number;
	type: string | null;
}

export interface BuildData {
	app_dir: string;
	app_path: string;
	manifest_data: ManifestData;
	service_worker: string | null;
	client_entry: {
		file: string;
		imports: string[];
		stylesheets: string[];
		fonts: string[];
	} | null;
	server_manifest: import('vite').Manifest;
}

export interface CSRPageNode {
	component: typeof SvelteComponent;
	universal: {
		load?: Load;
		trailingSlash?: TrailingSlash;
	};
}

export type CSRPageNodeLoader = () => Promise<CSRPageNode>;

/**
 * Definition of a client side route.
 * The boolean in the tuples indicates whether the route has a server load.
 */
export type CSRRoute = {
	id: string;
	exec(path: string): undefined | Record<string, string>;
	errors: Array<CSRPageNodeLoader | undefined>;
	layouts: Array<[has_server_load: boolean, node_loader: CSRPageNodeLoader] | undefined>;
	leaf: [has_server_load: boolean, node_loader: CSRPageNodeLoader];
};

export type GetParams = (match: RegExpExecArray) => Record<string, string>;

export interface ServerHooks {
	handleFetch: HandleFetch;
	handle: Handle;
	handleError: HandleServerError;
}

export interface ClientHooks {
	handleError: HandleClientError;
}

export class InternalServer extends Server {
	init(options: ServerInitOptions): Promise<void>;
	respond(
		request: Request,
		options: RequestOptions & {
			prerendering?: PrerenderOptions;
			read: (file: string) => Buffer;
		}
	): Promise<Response>;
}

export interface ManifestData {
	assets: Asset[];
	nodes: PageNode[];
	routes: RouteData[];
	matchers: Record<string, string>;
}

export interface PageNode {
	depth: number;
	component?: string; // TODO supply default component if it's missing (bit of an edge case)
	universal?: string;
	server?: string;
	parent_id?: string;
	parent?: PageNode;
	/**
	 * Filled with the pages that reference this layout (if this is a layout)
	 */
	child_pages?: PageNode[];
}

export interface PrerenderDependency {
	response: Response;
	body: null | string | Uint8Array;
}

export interface PrerenderOptions {
	cache?: string; // including this here is a bit of a hack, but it makes it easy to add <meta http-equiv>
	fallback?: boolean;
	dependencies: Map<string, PrerenderDependency>;
}

export type RecursiveRequired<T> = {
	// Recursive implementation of TypeScript's Required utility type.
	// Will recursively continue until it reaches a primitive or Function
	[K in keyof T]-?: Extract<T[K], Function> extends never // If it does not have a Function type
		? RecursiveRequired<T[K]> // recursively continue through.
		: T[K]; // Use the exact type for everything else
};

export type RequiredResolveOptions = Required<ResolveOptions>;

export interface Respond {
	(
		request: Request,
		options: SSROptions,
		manifest: SSRManifest,
		state: SSRState
	): Promise<Response>;
}

export interface RouteParam {
	name: string;
	matcher: string;
	optional: boolean;
	rest: boolean;
	chained: boolean;
}

/**
 * Represents a route segment in the app. It can either be an intermediate node
 * with only layout/error pages, or a leaf, at which point either `page` and `leaf`
 * or `endpoint` is set.
 */
export interface RouteData {
	id: string;
	parent: RouteData | null;

	segment: string;
	pattern: RegExp;
	params: RouteParam[];

	layout: PageNode | null;
	error: PageNode | null;
	leaf: PageNode | null;

	page: {
		layouts: Array<number | undefined>;
		errors: Array<number | undefined>;
		leaf: number;
	} | null;

	endpoint: {
		file: string;
	} | null;
}

export type ServerData =
	| {
			type: 'redirect';
			location: string;
	  }
	| {
			type: 'data';
			/**
			 * If `null`, then there was no load function
			 */
			nodes: Array<ServerDataNode | ServerDataSkippedNode | ServerErrorNode | null>;
	  };

/**
 * Signals a successful response of the server `load` function.
 * The `uses` property tells the client when it's possible to reuse this data
 * in a subsequent request.
 */
export interface ServerDataNode {
	type: 'data';
	data: Record<string, any> | null;
	uses: Uses;
	slash?: TrailingSlash;
}

/**
 * Signals that the server `load` function was not run, and the
 * client should use what it has in memory
 */
export interface ServerDataSkippedNode {
	type: 'skip';
}

/**
 * Signals that the server `load` function failed
 */
export interface ServerErrorNode {
	type: 'error';
	error: App.Error;
	/**
	 * Only set for HttpErrors
	 */
	status?: number;
}

export interface ServerMetadata {
	nodes: Array<{ has_server_load: boolean }>;
	routes: Map<
		string,
		{
			prerender: PrerenderOption | undefined;
			methods: HttpMethod[];
		}
	>;
}

export interface SSRComponent {
	default: {
		render(props: Record<string, any>): {
			html: string;
			head: string;
			css: {
				code: string;
				map: any; // TODO
			};
		};
	};
}

export type SSRComponentLoader = () => Promise<SSRComponent>;

export interface SSRNode {
	component: SSRComponentLoader;
	/** index into the `components` array in client/manifest.js */
	index: number;
	/** client-side module URL for this component */
	file: string;
	/** external JS files */
	imports: string[];
	/** external CSS files */
	stylesheets: string[];
	/** external font files */
	fonts: string[];
	/** inlined styles */
	inline_styles?(): MaybePromise<Record<string, string>>;

	universal: {
		load?: Load;
		prerender?: PrerenderOption;
		ssr?: boolean;
		csr?: boolean;
		trailingSlash?: TrailingSlash;
	};

	server: {
		load?: ServerLoad;
		prerender?: PrerenderOption;
		ssr?: boolean;
		csr?: boolean;
		trailingSlash?: TrailingSlash;
		actions?: Actions;
	};

	// store this in dev so we can print serialization errors
	universal_id?: string;
	server_id?: string;
}

export type SSRNodeLoader = () => Promise<SSRNode>;

export interface SSROptions {
	app_template_contains_nonce: boolean;
	csp: ValidatedConfig['kit']['csp'];
	csrf_check_origin: boolean;
	embedded: boolean;
	env_public_prefix: string;
	hooks: ServerHooks;
	root: SSRComponent['default'];
	service_worker: boolean;
	templates: {
		app(values: {
			head: string;
			body: string;
			assets: string;
			nonce: string;
			env: Record<string, string>;
		}): string;
		error(values: { message: string; status: number }): string;
	};
}

export interface SSRErrorPage {
	id: '__error';
}

export interface PageNodeIndexes {
	errors: Array<number | undefined>;
	layouts: Array<number | undefined>;
	leaf: number;
}

export type SSREndpoint = Partial<Record<HttpMethod, RequestHandler>> & {
	prerender?: PrerenderOption;
	trailingSlash?: TrailingSlash;
};

export interface SSRRoute {
	id: string;
	pattern: RegExp;
	params: RouteParam[];
	page: PageNodeIndexes | null;
	endpoint: (() => Promise<SSREndpoint>) | null;
	endpoint_id?: string;
}

export interface SSRState {
	fallback?: string;
	getClientAddress(): string;
	initiator?: SSRRoute | SSRErrorPage;
	platform?: any;
	prerendering?: PrerenderOptions;
	/**
	 * When fetching data from a +server.js endpoint in `load`, the page's
	 * prerender option is inherited by the endpoint, unless overridden
	 */
	prerender_default?: PrerenderOption;
	read?: (file: string) => Buffer;
}

export type StrictBody = string | ArrayBufferView;

export interface Uses {
	dependencies: Set<string>;
	params: Set<string>;
	parent: boolean;
	route: boolean;
	url: boolean;
}

export type ValidatedConfig = RecursiveRequired<Config>;

export type ValidatedKitConfig = RecursiveRequired<KitConfig>;

export * from './index';
export * from './private';

declare global {
	const __SVELTEKIT_ADAPTER_NAME__: string;
	const __SVELTEKIT_APP_VERSION_FILE__: string;
	const __SVELTEKIT_APP_VERSION_POLL_INTERVAL__: number;
	const __SVELTEKIT_DEV__: boolean;
	const __SVELTEKIT_EMBEDDED__: boolean;
	var Bun: object;
	var Deno: object;
}
