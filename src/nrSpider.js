var nrSpider = {

    //解析前缀
    parsingKey: "nr",

    //请求量
    countRequest: 0,
    //当前请求量
    currentRequest: 0,
    //最后请求时间
    lastRequestTime: Date.now(),

    //队列记录
    queueList: [],

    //初始化
    inited: false,

    //延迟
    defer: {},

    /**
     * 队列新增
     * @param {any} task
     */
    queueAdd: function (task) {
        if (nrSpider.type(task) == "Array") {
            nrSpider.queueList = nrSpider.queueList.concat(task);
        } else {
            nrSpider.queueList.push(task);
        }
    },

    /**
     * 队列消费
     * @param {any} n
     */
    queueUse: function (n) {
        var len = nrSpider.queueList.length;
        if (len) {
            return nrSpider.queueList.splice(0, Math.min(n || 1, len));
        }
        return null;
    },

    /**
     * 输出熔断
     * @param {any} msg 消息
     * @param {any} type 分类
     */
    consoleFuse: function (msg, type) {
        var dkey = `console${type}`, ltkey = `lastTime${type}`, now = Date.now();
        if (nrSpider.defer[ltkey] == null || now - nrSpider.defer[ltkey] > 3000) {
            nrSpider.defer[ltkey] = now;
            console.warn(msg)
        } else {
            clearTimeout(nrSpider.defer[dkey]);
            nrSpider.defer[dkey] = setTimeout(() => {
                console.warn(msg)
            }, 500);
        }
    },

    /**
     * 任务熔断
     * @param {any} task 任务
     * @param {any} gap 间隔时间，默认1000毫秒
     */
    taskFuse: function (task, gap) {
        gap = gap || 1000;

        clearInterval(nrSpider.defer.task);
        nrSpider.defer.task = setInterval(() => {
            var notGap = Date.now() - nrSpider.lastRequestTime < gap, isLimit = nrSpider.currentRequest > 0;
            if (notGap || isLimit) {
                nrSpider.consoleFuse('task is limit, waiting...', 'task');
            } else {
                task();
            }
        }, 10);

        document.onkeydown = (e) => {
            //Pause/Break
            if (e.keyCode == 19) {
                clearInterval(nrSpider.defer.task);
                nrSpider.defer.taskStatus = 0;
                console.warn("任务已暂停");
            }
        }
    },

    /**
     * 载入 js
     * @param {any} src
     */
    getScript: function (src) {
        return new Promise((resolve) => {
            var ele = document.createElement("SCRIPT");
            ele.src = src;
            ele.type = "text/javascript";
            document.getElementsByTagName("HEAD")[0].appendChild(ele);

            ele.onload = ele.onreadystatechange = function () {
                if (!this.readyState || this.readyState == "loaded" || this.readyState == "complete") {
                    resolve();
                }
            }
        })
    },

    /**
     * 载入JS
     * @param {any} srcs
     */
    getScripts: function (srcs) {
        var parr = [];
        srcs.forEach(src => parr.push(nrSpider.getScript(src)));
        return Promise.all(parr)
    },

    /**
     * 判断类型
     * @param {any} obj
     */
    type: function (obj) {
        var tv = {}.toString.call(obj);
        return tv.split(' ')[1].replace(']', '');
    },

    /**
     * 解析HTML
     * @param {any} html
     * @param {any} link
     */
    parsingHtml: function (html, link) {
        link = link || location.href;

        var vdom = document.createElement('div'), skey = ["src", "href"];
        skey.forEach(key => html = html.replaceAll(`${key}=`, `${nrSpider.parsingKey}${key}=`));
        vdom.innerHTML = html;

        skey.forEach(key => {
            var nrkey = nrSpider.parsingKey + key;
            vdom.querySelectorAll(`[${nrkey}]`).forEach(node => {
                var paths = link.split('/');
                paths.pop();

                var attr = node.getAttribute(`${nrkey}`);
                if (attr != null && !attr.startsWith("http") && !attr.startsWith("javascript:")) {
                    var newattr;
                    if (attr.startsWith("/")) {
                        newattr = new URL(link).origin + attr;
                    } else {
                        while (attr.startsWith('../')) {
                            attr = attr.substring(3);
                            paths.pop();
                        }
                        newattr = paths.join('/') + '/' + attr;
                    }
                    node.setAttribute(`${nrkey}`, newattr);
                }
            })
        })
        return vdom;
    },

    /**
     * 获取或设置属性
     * @param {any} node
     * @param {any} name
     */
    parsingAttr: function (node, name) {
        return node.getAttribute(nrSpider.parsingKey + name);
    },

    /**
     * 请求链接
     * @param {any} url
     * @param {any} encoding
     */
    requestLink: function (url, encoding) {
        return new Promise((resolve, reject) => {
            //请求数
            nrSpider.countRequest++;
            nrSpider.currentRequest++;
            nrSpider.lastRequestTime = Date.now();

            fetch(url).then(res => {
                nrSpider.currentRequest--;

                if (res.status == 200) {
                    return res.blob();
                } else {
                    reject(res.status + " " + res.statusText);
                }
            }).then(blob => {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var res = e.target.result;
                    resolve(res);
                }
                reader.readAsText(blob, encoding || 'utf-8');
            }).catch(err => {
                nrSpider.currentRequest--;

                reject(err)
            })
        })
    },

    /**
     * 请求（自动缓存）
     * @param {any} url
     * @param {any} encoding 编码
     * @param {any} cachePrefix 缓存前缀
     */
    requestCache: function (url, encoding, cachePrefix) {
        return new Promise((resolve, reject) => {
            var ckey = `${cachePrefix}:${url}`
            nrSpider.getItem(ckey).then(res => {
                if (res == null) {
                    nrSpider.requestLink(url, encoding).then(html => {
                        nrSpider.setItem(ckey, html);
                        resolve(html);
                    }).catch(err => {
                        reject(err);
                    })
                } else {
                    resolve(res);
                }
            })
        })
    },

    /**
     * blob 构建 文本
     * @param {any} data
     */
    blobCreateText: function (data) {
        var blob = new Blob([data], { type: "text/plain;charset=utf-8" });
        return blob;
    },

    /**
     * blob 构建
     * @param {any} data
     * @param {any} type
     */
    blobCreate: function (data, type) {
        var blob = new Blob([data], { type: type });
        return blob;
    },

    /**
     * blob 下载
     * @param {any} blob
     * @param {any} filename
     */
    blobDownload: function (blob, filename) {
        return saveAs(blob, filename)
    },

    /**
     * blob 转 url
     * @param {any} blob
     */
    blobAsUrl: function (blob) {
        return window.URL.createObjectURL(blob);
    },

    /**
     * blob 请求
     * @param {any} src
     */
    blobGet: function (src) {
        return fetch(src, {
            method: 'get',
            responseType: 'blob'
        }).then(res => {
            return res.blob();
        });
    },

    /**
     * array => excel
     * @param {any} arr
     * @param {any} heads 头宽度（可选） {id:70,txt:150}
     */
    arrayToExcel: function (arr, heads) {
        return new Promise((resolve) => {
            var workbook = new ExcelJS.Workbook();

            workbook.creator = 'netnr';
            workbook.lastModifiedBy = 'netnr';
            workbook.created = new Date();
            workbook.modified = workbook.created;
            workbook.lastPrinted = workbook.created;

            var worksheet = workbook.addWorksheet("Sheet1");
            worksheet.views = [
                { state: 'frozen', xSplit: 0, ySplit: 1 }
            ];

            //填充头部
            var headers = [];
            if (heads == null) {
                heads = {};
                for (var i in arr[0]) {
                    heads[i] = 120;
                }
            }
            for (var i in heads) {
                headers.push({ header: i, key: i, width: heads[i] / 7, style: { alignment: { vertical: 'middle', horizontal: 'left' } } })
            }
            worksheet.columns = headers;

            //头部样式
            var firstRow = worksheet.getRow(1);
            firstRow.height = 20;
            firstRow.font = { size: 12, bold: true };
            for (var i = 1; i <= headers.length; i++) {
                var cell = firstRow.getCell(i);
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            }

            //填充数据行
            var rows = [];
            arr.forEach(obj => rows.push(Object.values(obj)));
            worksheet.addRows(rows);

            //保存
            workbook.xlsx.writeBuffer().then(function (data) {
                var blob = nrSpider.blobCreate(data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                resolve(blob);
            });
        })
    },

    /**
     * array => SQL
     * @param {any} arr
     * @param {any} tableName 表名
     * @param {any} cols 列 {id:"text primary key not null",txt:"text",deep:"int not null"}
     */
    arrayToSQL: function (arr, tableName, cols) {
        return new Promise((resolve) => {
            var esql = [];

            //创建数据库
            var fiels = [];
            for (var i in cols) {
                fiels.push(`${i} ${cols[i]}`);
            }
            esql.push(`CREATE TABLE ${tableName}(${fiels.join(',')})`);

            //写入数据
            arr.forEach(obj => {
                var values = [];
                for (var i in cols) {
                    values.push(cols[i] == "int" ? obj[i] : `'${obj[i]}'`);
                }
                esql.push(`INSERT INTO ${tableName} VALUES (${values.join(',')})`)
            });

            resolve(esql.join(';\n'));
        })
    },

    //初始化
    init: function () {
        return new Promise((resolve) => {
            if (nrSpider.inited) {
                resolve();
            } else {
                nrSpider.getScripts([
                    "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js",
                    "https://cdn.jsdelivr.net/npm/jszip@3.7.1/dist/jszip.min.js",
                    "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js",
                    "https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js"
                ]).then(() => {

                    nrSpider.setItem = localforage.setItem;
                    nrSpider.getItem = localforage.getItem;

                    nrSpider.inited = true;
                    resolve();
                });
            }
        })
    }
}

nrSpider.init();