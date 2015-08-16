## cssurl-rev

> 给 CSS 文件中的 url 加上 md5 时间戳

## 安装

```shell
npm install --save cssurl-rev
```

## 使用方法

```javascript
var Rev = require('cssurl-rev');

new Rev()
    .src('css/*.css')
    .dest('build/css')
    .run(function (err, files) {
        // done callback
    });
```

你还可以给 `run` 方法传入一个 `repalcer` 来处理时间戳:

```javascript
var Rev = require('cssurl-rev');
var replacer = function (url, hash) {
    return url + '?' + hash;
};

new Rev()
    .src('css/*.css')
    .dest('build/css')
    .run({ replacer: replacer }, function (err, files) {
        // done callback
    });
```

## Example

app.css

```css
@import url(http://example.com/reset.css?20150811);
@import url(buttons.css);

body {
    background: url(images/hello.png?v=20150811);
}
```

JS

```javascript
new Rev()
    .src('app.css')
    .dest('build/')
    .run();
```

Output:

build/app.css

```css
@import url(http://example.com/reset.css?20150811=&v={md5});
@import url(buttons.css?v={md5});

body {
    background: url(images/hello.png?v={md5});
}
```


之后会在 `build` 目录下生成处理过后的文件。里面所有的 url 都会加上一个其对应文件的 md5 值 (截取前 10 位)。

## API

### src(globs)

样式文件的路径，格式参考 [`vinyl-fs`](https://github.com/wearefractal/vinyl-fs#srcglobs-opt)

### dest(folder)

处理后的文件的保存的文件夹

### run([option, callback])

#### option

* option.replacer:Function

    如果你自己处理 url 和 hash 的话可以设置一个 `replacer`

    ```js
    function replacer(url, hash) {
        return url + '?' + hash;
    }
    ```

* option.skipRemote

    跳过所有的远程的 url。即像 `http://example.com/reset.css` 这样的 url 会被忽略掉。默认是 `false`

#### callback(err, files)

处理完成或出错的回调函数


