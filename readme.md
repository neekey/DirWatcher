##DirWatcher 监视你的目录

监控指定目录中文件的增加，删除，修改，子目录的增加，删除等

安装 `npm install DirWatcher`

### USAGE 使用

	var dw = require( './DirWatcher' );
	dw.watchDir( 'path', function( ifDir, path, cur, pre ){
		
		// ifDir 是否为目录
		// path 文件或者目录的路径
		// type 变更类型 'modify' 'remove' 'add'
		// cur 当文件变更时，包含当前文件的信息
		// pre 当文件变更时，包含变更前文件信息	
	});
	
###API

####watchDir( path, next )

* `path`: 目录的路径
* `next`: 回调，包含五个个参数`ifDir`, `path`, `type`, `cur`, `pre`

####readDir( path, next )

对制定目录进行递归便利，对每一个有效路径执行一次回调

* `path`: 目录的路径
* `next`: 回调，为目录下的每一个文件或者子目录执行一次回调。回调包含
* * err
* * path: 路径
* * ifDir: 是否为目录

###Exception 配置例外

可以通过在需要添加例外的目录下添加名为`.nowatch`文件，来添加例外. 例外添加的规则：

* 每一行为一条例外
* 一行中若出现空格，空格后的内容将被忽略
* 使用`#`进行注释
* 以`/`结尾的例外将被视为目录，否则为具体的文件名

###存在的问题

* 当watch的文件和目录过多，将报错`EMFILE`的错误
* 当一个路径被删除，然后再新建同名路径时将无法重新`watch`该路径（对于目录应该问题不大，但是对于文件，暂时无法解决）
hah