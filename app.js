const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
    res.redirect('/index.html');
});
app.use(express.static('public'));
app.use(express.static('assets'));

app.listen(app.get('port'), () => {
    console.log(app.get('port'), '번 포트에서 대기 중');
});

// 백엔드 프록시 (스프링 부트: http://localhost:8080)
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:8080',
    changeOrigin: true,

    // 쿠키와 인증 흐름을 건드리지 않음 (SameSite=Lax로도 OK, same-origin이기 때문)
    // 필요 시 Path rewrite 가능
    pathRewrite: { '^': '/api' },

    // 타임아웃/에러 핸들링
    proxyTimeout: 30_000,
    onError(err, req, res) {
        console.error('Proxy error:', err?.message);
        if (!res.headersSent) {
            res.status(502).json({ message: 'Upstream unavailable' });
        }
    },
}));