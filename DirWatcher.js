/**
 * 监控指定目录中文件的增加，删除，修改，子目录的增加，删除等
 * @auth neekey <ni184775761@gmail.com>
 */

var fs = require( 'fs' );
var Path = require( 'path' );
var crypto = require( 'crypto' );

// 忽略配置文件名称
var ignoreFileName = '.nowatch';
// 用于记录哪些路径已经处于watch状态
var WatchList = {};
// 用于储存个目录信息
var DirList = {};
// 用于储存每个文件的MD5，path -> md5
var FileMd5 = {};

// 变更状态枚举
var ChangeType = {
    // 文件或者目录有变化
    modify: 'modify',
    // 文件或者目录的添加
    add: 'add',
    // 文件或者目录被移除
    remove: 'remove'
};

var Util = {

    /**
     * 比较两个数组
     * @param {Array} pre
     * @param {Array} cur
     * @return {Object} { remove: pre相比cur 减少的项，add: cur相比pre增多的项 }
     * @private
     */
    _pathCompare: function( pre, cur ){

        var preCopy = pre.join('@').split('@');
        var curCopy = cur.join('@').split('@');
        var duplExists = false;
        var removeArr = [];
        var newArr = [];

        // 去除重复的部分
        preCopy.forEach( function ( itemPre, indexPre ){

            duplExists = false;

            curCopy.forEach( function ( itemCur, indexCur ){

                if( itemPre === itemCur ){

                    duplExists = true;

                    curCopy[ indexCur ] = undefined;
                }
            });

            if( duplExists ){

                preCopy[ indexPre ] = undefined;
            }
        });

        // arrAcopy中剩下的极为删除掉的路径
        preCopy.forEach(function ( item ){

            if( item !== undefined ){

                removeArr.push( item );
            }
        });

        // arrBCopy中剩下的即为新增的路径
        curCopy.forEach( function ( item ){

            if( item !== undefined ){

                newArr.push( item );
            }
        });

        return {
            remove: removeArr,
            add: newArr
        }
    }

};

/**
 * 获取路径下是否有过滤配置文件，有则读取解析，返回被过滤的目录名
 * 每一行一个过滤目录（若一行中有空格，则忽略空格后的内容）
 * 使用#作为注释
 * 最后包含'/'将被视为目录，否则为文件
 * @param path
 * @param next function( err, igArr )
 *
 * //todo 增强配置文件的功能，比如正则什么的...
 */
function parseIgnoreFile( path, next ){

    var ignorePath = ( path[ path.length - 1 ] === '/' ) ? ( path + ignoreFileName ) : ( path + '/' + ignoreFileName );

    fs.readFile( ignorePath, function ( err, data ){

        if( err ){
            // 若文件不存在，则返回空数组
            if( err.code === 'ENOENT' ){

                next( undefined, [] );
            }
            else {
                next( err );
            }
        }
        else {

            var str = data.toString( 'utf-8');
            var igArrTemp = str.split( /\n/ );
            var igArr = [];

            igArrTemp.forEach(function ( item ){

                var cmtIndex = item.indexOf( '#' );
                var arr;

                // 对注释符号后面的内容进行过滤
                if( cmtIndex >= 0 ){

                    item = item.substring( 0, cmtIndex );
                }

                // 忽略第一个空格后的内容
                arr = item.split( /\s+/ );
                igArr.push( arr[ 0 ] );
            });

            next( undefined, igArr );
        }
    });
}

/**
 * 读取文件目录，遍历所有的文件和目录( 包含dir )
 * @param {String} dir 绝对/相对
 * @param {Function} next function( err, path, ifDir )
 * @param {Boolean} ifIgnore 是否读取目录中的配置文件
 */
function readDir( dir, next, ifIgnore ){

    // 转化为绝对地址
    dir = Path.resolve( dir );

    // 检查是否为目录
    fs.stat( dir, function ( err, stats ){

        if( err ){

            next( err );
            return;
        }

        // 如果为目录
        if( stats.isDirectory() ){

            next( undefined, dir, true );

            _readDir( dir, next, ifIgnore );
        }
    });
}

/**
 * 读取文件目录，遍历所有的文件和目录( 不包含dir )
 * @param {String} dir 绝对/相对
 * @param {Function} next function( err, path, ifDir )
 * @param {Boolean} ifIgnore 是否读取目录中的配置文件
 */
function _readDir( dir, next, ifIgnore ){

    // 转化为绝对地址
    dir = Path.resolve( dir );

    // 检查当前路径是否为dir
    var _arguments = arguments;
    ifIgnore = ( typeof ifIgnore === 'undefined' ) ? true : ifIgnore;

    // 检查是否为目录
    fs.stat( dir, function ( err, stats ){

        if( err ){

            next( err );
            return;
        }

        // 如果为目录
        if( stats.isDirectory() ){

            // 遍历目录
            fs.readdir( dir, function ( err, pathArr ){

                if( err ){
                    next( err );
                }
                else {

                    // 读取当前目录下的过滤配置文件
                    parseIgnoreFile( dir, function ( err, igArr ){

                        if( err ){

                            next( err );
                        }

                        // 遍历目录中的路径
                        pathArr.forEach( function ( path ){

                            // 转化为绝对地址
                            var subPath = Path.resolve( dir, path );

                            var ifDir = false;

                            // 判断是否为目录
                            fs.stat( subPath, function ( err, stats ){

                                if( err ){
                                    next( err );
                                }
                                else {

                                    // 如果为目录
                                    if( stats.isDirectory() ){

                                        ifDir = true;

                                        // 对目录文件添加 '/' 以对配置文件中的列表进行匹配
                                        path = path.indexOf( '/' ) === ( path.length -1 ) ? path : path + '/';

                                        // 根据配置文件过滤目录
                                        if( ifIgnore && igArr && igArr.indexOf( path ) >= 0 ){

                                            return;
                                        }

                                        _arguments.callee( subPath, next );
                                    }
                                    else {

                                        // 过滤文件
                                        if( ifIgnore && igArr && igArr.indexOf( path ) >= 0 ){

                                            return;
                                        }
                                    }

                                    next( undefined, subPath, ifDir );
                                }
                            });
                        });
                    });
                }
            });
        }
        else {

            throw new Error( dir + ' is not a directory' );
        }
    } );
}


/**
 * 监听目录
 * @param {String} dir 绝对/相对
 * @param {Function} next function( ifDir, path, cur, pre )
 */
function watchDir( dir, next ){

    // 转化为绝对地址
    dir = Path.resolve( dir );

    next = typeof next == 'function' ? next : function(){};

    readDir( dir, function ( err, path, ifDir ){

        if( err ){

            console.log( err );
        }
        else {

            // 若为文件
            if( !ifDir ){

                _watchFile( path, next );
            }

            // 若为目录
            else {

                _checkDir( path, next );
            }
        }
    });
}

/**
 * 监听单个文件
 * @param {String} path 绝对
 * @param {Function} next
 * @private
 */
function _watchFile( path, next ){

    // 检查文件是否已经处于watch状态
    if( WatchList[ path ] !== true ){

        console.log( 'watch file: ' + path );

        // 预先计算MD5值
        _saveFileMd5( path, function ( err, md5 ){

            if( err ){

                console.log( err );
            }
            else {

                fs.watchFile( path, function ( cur, pre ){

                    // 过滤掉：只读操作，比如读取文件
                    // 由于对文件进行md5计算时，会出发读的变更
                    // 若不过滤，将不断循环调用
                    if( cur.mtime.valueOf() === pre.mtime.valueOf() &&
                        cur.ctime.valueOf() === pre.ctime.valueOf() ){

                        return;
                    }

                    // 一个文件被重写（即使内容不变）也会更新mtime和ctime，
                    // 比如cat a.js > b.js 即使两个文件的内容一致，b.js 也会更新
                    // 因此需要比较文件的md5值
                    _ifFileChange( path, function ( err, ifChange ){

                        if( err ){

                            console.log( err );
                        }
                        else {

                            if( ifChange ){

                                var parentPath = Path.dirname( path );
                                var type = ChangeType.modify;

                                console.log( 'File: %s changed！Time：%s', path, String( new Date() ) );
                                next( false, path, type, cur, pre );

                                // 一个文件的变更，将引发该目录的变更
                                // todo 递归向上 出发目录的父目录的变更
                                console.log( 'Directory: %s changed！Time：%s', parentPath, String( new Date() ) );
                                next( true, parentPath, type );
                            }
                        }

                    });

                });

                // 将path标记为已经监听
                WatchList[ path ] = true;
            }
        });


    }
}

/**
 * 监听目录
 * @param {String} path 绝对
 * @param {Function} next
 * @private
 */
function _checkDir( path, next ){

    fs.readdir( path, function ( err, pathArr ){

        var oldPathArr = DirList[ path ];
        var compareResult;
        var removeArr;
        var addArr;

        // 检查是否已经记录该目录下的路径，若已经有，则进行比较

        if( !oldPathArr || ( oldPathArr && oldPathArr.constructor !== Array ) ){

            console.log( 'watch directory:' + path );
            DirList[ path ] = pathArr;
        }
        else {

            compareResult = Util._pathCompare( oldPathArr, pathArr );
            removeArr = compareResult.remove;
            addArr = compareResult.add;

            // 遍历所有被remove的path，移除正在监听的标记
            removeArr.forEach(function ( item, index ){

                var subPath = Path.resolve( path, item );
                var p;

                delete WatchList[ subPath ];

                // 检查是否为目录
                if( subPath in DirList ){

                    console.log( 'unwatch directory:' + subPath );

                    delete DirList[ subPath ];

                    next( true, subPath, ChangeType.remove );

                    // 移除该目录下的所有子文件
                    for( p in WatchList ){

                        // 检查是否为子文件
                        if( p.indexOf( subPath ) === 0 ){

                            delete WatchList[ p ];
                            console.log( 'unwatch file:' + p );

                            next( false, p, ChangeType.remove );
                        }
                    }

                    // 移除该目录下所有子目录
                    for( p in DirList ){

                        // 检查是否为子目录
                        if( p.indexOf( subPath ) === 0 ){

                            delete WatchList[ p ];
                            console.log( 'unwatch directory:' + p );

                            next( true, p, ChangeType.remove );
                        }
                    }

                }
                else {

                    console.log( 'unwatch file:' + subPath );
                    next( false, subPath, ChangeType.remove );
                }
            });

            // 便利所有新增的path
            addArr.forEach(function ( item ){

                var subPath = Path.resolve( path, item );

                // 检查是否为目录
                fs.stat( subPath, function ( err, stats ){

                    if( err ){

                        console.log( err );
                    }
                    else {

                        if( stats.isDirectory() ){

                            // 对新目录进行监视
                            watchDir( subPath, next );
                            next( true, subPath, ChangeType.add );
                        }
                        else {

                            // 对新文件进行监视
                            _watchFile( subPath, next );
                            next( false, subPath, ChangeType.add );
                        }
                    }
                });
            });

            // 更新目录信息
            DirList[ path ] = pathArr;
        }
    });
}

/**
 * 检查文件是否有变化
 * @param {String} path 绝对
 * @param {Function} next function( err, ifChange ){}
 * @private
 */
function _ifFileChange( path, next ){

    if( FileMd5[ path ] === undefined ){

        _saveFileMd5( path, function ( err, md5 ){

            if( err ){

                next( err );
            }
            else {
                next( undefined, true );
            }
        });

    }
    else {

        var oldMd5 = FileMd5[ path ];

        _saveFileMd5( path, function ( err, md5 ){

            if( err ){

                next( err );
            }
            else {

                if( md5 === oldMd5 ){

                    next( err, false );
                }
                else {

                    next( err, true );
                }
            }
        });

    }
}

/**
 * 保存文件的MD5值
 * @param {String} path 绝对
 * @param {Function} next function( err, md5 )
 * @private
 */
function _saveFileMd5( path, next ){


    fs.readFile( path, function ( err, data ){

        if( err ){

            next( err );
        }
        else {
            var hex = crypto.createHash( 'md5' );

            hex.update( data );
            var md5 = hex.digest( 'hex' );

            FileMd5[ path ] = md5;

            next( err, md5 );
        }
    });
}

/* ========= API ======= */

/**
 * 监听制定目录下的文件/目录变化
 * @type {Function}
 * @param {String} path 绝对/相对地址
 * @param {Function} next function( ifDir, path, cur, pre )
 */
exports.watchDir = function (){

    var _arguments = arguments;
    var that = this;

    setInterval( function (){

        watchDir.apply( that, _arguments );
    }, 200 );
};

/**
 * 遍历制定目录下的所有文件/目录，将每个路径作为参数在回调函数中返回
 * @type {Function}
 * @param {String} path 绝对/相对
 * @param {Function} next function( err, path, ifDir )
 */
exports.readDir = readDir;
