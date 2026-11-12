import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		public: false,
		static: true
	},
	PUBLIC_API_URL: {
		public: true,
		static: true
	},
	PUBLIC_GITHUB: {
		public: true,
		static: true
	},
	APP_REPO: {
		public: true,
		static: true
	},
	FRONTEND_REPO: {
		public: true,
		static: true
	},
	BACKEND_REPO: {
		public: true,
		static: true
	},
	TICM_REPO: {
		public: true,
		static: true
	}
});