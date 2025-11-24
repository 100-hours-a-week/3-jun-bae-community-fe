const request = require('supertest');

const ORIGINAL_ENV = { ...process.env };

const loadApp = () => require('./app');

const extractDefaults = (payload) => {
    const match = payload.match(/Object\.freeze\(([\s\S]+?)\);\n\nexport/);
    if (!match) {
        throw new Error('defaults payload 파싱 실패');
    }
    return JSON.parse(match[1]);
};

describe('app.js 라우트', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('GET / 는 /index.html 로 리다이렉트한다', async () => {
        const app = loadApp();
        const res = await request(app).get('/');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/index.html');
    });

    it('GET /js/core/defaults.js 는 기본 설정을 반환한다', async () => {
        const app = loadApp();

        delete process.env.APP_NAME;
        delete process.env.API_BASE;
        delete process.env.TIMEOUT_MS;

        const res = await request(app).get('/js/core/defaults.js');

        expect(res.status).toBe(200);
        expect(res.type).toMatch(/application\/javascript/);

        const config = extractDefaults(res.text);
        expect(config).toEqual({
            APP_NAME: 'MyCommunity',
            API_BASE: 'https://api.community.junbeom.site/api',
            TIMEOUT_MS: 10_000,
        });
    });

    it('환경 변수로 기본 설정을 덮어쓴다', async () => {
        process.env.APP_NAME = 'CustomApp';
        process.env.API_BASE = 'https://example.com/api';
        process.env.TIMEOUT_MS = '15000';

        const app = loadApp();
        const res = await request(app).get('/js/core/defaults.js');

        expect(res.status).toBe(200);

        const config = extractDefaults(res.text);
        expect(config).toEqual({
            APP_NAME: 'CustomApp',
            API_BASE: 'https://example.com/api',
            TIMEOUT_MS: 15000,
        });
    });
});