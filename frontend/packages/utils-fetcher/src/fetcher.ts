export const fetcher = (options: {
	fetch?: typeof fetch;
	method: 'POST' | 'GET';
	endpoint: string;
	variables?: object;
}) => {
	const { method, endpoint, variables } = options;

	return (options.fetch ?? fetch)(endpoint, {
		method,
		headers: {
			'Content-Type': 'application/json',
		},
		...(method === 'GET' ? {} : { body: JSON.stringify(variables) }),
	});
};
