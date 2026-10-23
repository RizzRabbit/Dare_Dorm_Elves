import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

// rgs_url may arrive bare ("rgs.example.com") or with a scheme; add https:// only when missing.
export const rgsBaseUrl = (rgsUrl: string) => {
	const value = (rgsUrl || '').trim();
	if (!value) throw { error: 'ERR_RGS_URL', message: 'Missing rgs_url: the game cannot connect to the game server.' };
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
	try {
		new URL(withScheme);
	} catch {
		throw { error: 'ERR_RGS_URL', message: `Invalid rgs_url: ${value}` };
	}
	return withScheme.replace(/\/+$/, '');
};

// Non-200 responses and network failures are thrown so every caller shows the error modal.
const send = async (options: { method: 'POST' | 'GET'; endpoint: string; variables?: object }) => {
	let response: Response;
	try {
		response = await fetcher(options);
	} catch (error) {
		throw { error: 'ERR_NETWORK', message: `Could not reach the game server (${(error as Error)?.message ?? error}).` };
	}
	let data: any = null;
	try {
		data = await response.json();
	} catch {
		data = null;
	}
	if (!response.ok) {
		throw {
			error: data?.error ?? `HTTP_${response.status}`,
			message: data?.message ?? (response.statusText || 'Request failed'),
		};
	}
	return data;
};

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		return (await send({
			method: 'POST',
			variables: options.variables,
			endpoint: `${rgsBaseUrl(options.rgsUrl)}${options.url}`,
		})) as TResponse;
	},
	get: async function get<
		T extends keyof paths,
		TResponse = paths[T]['get']['responses'][200]['content']['application/json'],
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		return (await send({
			method: 'GET',
			endpoint: `${rgsBaseUrl(options.rgsUrl)}${options.url}`,
		})) as TResponse;
	},
};
