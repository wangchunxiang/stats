var spu = {

    //版本号
    version: "1.0.0",
    date: "2020-04-28",

    //抓取数据
    dataMatch: [],

    /**
     * 匹配结果
     */
    matchResult: function () {
        var data = [];

        document.querySelectorAll('table')[1].querySelectorAll('tr').forEach(tr => {
            var tds = tr.querySelectorAll('td');
            if (tds.length == 3) {
                var obj = {
                    id: tds[0].innerText.trim(),
                    txt: tds[1].innerText.trim(),
                    remark: tds[2].innerText.trim()
                };
                if (obj.id != "" && obj.id != "代码") {
                    data.push(obj);
                }
            }
        })

        return data;
    },

    /**
     * 下载
     * @param {boolean} distinct 去重
     */
    zip: function (distinct) {
        console.warn("开始下载，构建数据中...")

        var zip = new JSZip();

        var data = spu.dataMatch;
        var dataCommon = spu.dataMatch.filter(x => !x.id.startsWith("3"));

        //导出总数据
        zip.file(`${spu.config.fileName}.json`, JSON.stringify(data));
        //导出通用（排除专用）
        zip.file(`${spu.config.fileName}-common.json`, JSON.stringify(dataCommon));

        console.warn("正在生成 Excel")
        nrSpider.arrayToExcel(data, { id: 80, txt: 200, remark: 300 }).then(blobExcel => {
            zip.file(`${spu.config.fileName}.xlsx`, blobExcel);

            console.warn("正在生成 SQL")
            nrSpider.arrayToSQL(data, spu.config.fileName.replaceAll('-', '_'), { id: "text primary key", txt: "text not null", remark: "text" }).then(esql => {
                zip.file(`${spu.config.fileName}.sql`, esql);

                console.warn("正在打包 ZIP")
                zip.generateAsync({ type: "blob" }).then(function (content) {
                    saveAs(content, `${spu.config.fileName}.zip`);
                });
            });
        });
    },

    //开始
    start: function () {
        nrSpider.init().then(() => {
            spu.dataMatch = spu.matchResult();
            spu.zip();
        });
    }
};

//参数配置
spu.config = {
    //下载名称：产品计量单位 http://tjj.hubei.gov.cn/bsfw/lwzb/ywzn/202005/t20200521_2282796.shtml
    fileName: "stats-product-unit"
};

//spu.zip(); //下载zip

spu.start(); //开始