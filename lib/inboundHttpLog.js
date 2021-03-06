const http = require('http');
const https = require('https');

const createLog = require('./createLog');
const options = require('./options');
const State = require('./state');

const state = new State();

const defaultOptions = options.getDefaults();

const nop = () => undefined;

module.exports = ({
    stringify = defaultOptions.stringify,
    getRequestId = defaultOptions.getRequestId,
    headers = defaultOptions.headers,
    parseReq,
    parseRes,
    logger = defaultOptions.logger,
    expressMiddleware
} = {}) => {
    options.validate({stringify, logger, headers, getRequestId});

    state.init(http.createServer, https.createServer);

    const log = expressMiddleware ? 
        expressMiddleware :
        createLog({
            stringify,
            logger,
            getRequestId,
            headers,
        });

    const proxyHandlerRequestListener =  {
        apply: (
                requestListenerOriginal,
                thisArg,
                [request, response, ...rest]
        ) => {
            log(request, response, nop);
            return requestListenerOriginal.apply(
                thisArg,
                [request, response, ...rest]
            );
        }
    };

    const proxyCreateServer = new Proxy(http.createServer, {
        apply: (
            createServerOriginal,
            thisArg,
            [requestListener, ...rest]
        ) => {
            if (typeof requestListener === 'function') {
                requestListener = new Proxy(
                    requestListener,
                    proxyHandlerRequestListener
                );
            }
            return createServerOriginal.apply(
                thisArg,
                [requestListener, ...rest]
            );
        }
    });
    
    http.createServer = proxyCreateServer;
    // https.createServer = proxyCreateServer; we should use a new proxy of https.createServer here
};

module.exports.reset = () => {
    const {
        httpCreateServerOriginal,
        httpsCreateServerOriginal
    } = state;

    if (httpCreateServerOriginal) {
        http.createServer = httpCreateServerOriginal;
    }
    
    if (httpsCreateServerOriginal) {
        https.createServer = httpsCreateServerOriginal;
    }
    
    state.reset();
};
