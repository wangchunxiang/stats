# stats
统计数据

### 说明
- nrSpider.js 为爬取基础依赖，拷贝到控制台先执行再跑对应的脚本
- 爬取抓取网页内容后存储于浏览器本地，再次请求从本地读取，失败的链接不缓存
- 爬取默认限制 1QPS，已存储本地链接不限制
- 导出数据有 Excel、SQL、JSON，（如果有）还包括失败的数据 catch-*.json

### ❤ product_category.js

统计用产品分类目录  
http://www.stats.gov.cn/tjsj/tjbz/tjypflml/index.html

最新发布时间 2010-06-17 ，共 5 级，爬 4 级错误链接 1 个，爬 5 级错误链接 87 个  
已根据代码 ID 去重，去除子节点与父节点相同的项

```
npm install stats-product-category
```

列信息

 字段 | 类型 | 说明
 ---- | ---- | ---- 
 id | string | 代码，唯一 
 txt | string | 名称 
 pid | string | 父级代码
 num | int | 同级排序 
 deep | int | 爬取层级 

