/**
 * 监控指定目录中文件的增加，删除，修改，子目录的增加，删除等
 * @auth neekey <ni184775761@gmail.com>
 */

var fs = require( 'fs' );

// 忽略配置文件名称
var ignoreFileName = '.nowatch';
// 用于记录哪些路径已经处于watch状态
//todo 解决当一个文件被删除，重新添加一个同名文件而无法被watch的问题
var WatchList = {};

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
 * 读取文件目录，遍历所有的文件和目录
 * @param dir
 * @param next function( err, path, ifDir )
 * @param ifIgnore 是否读取目录中的配置文件
 */
function readDir( dir, next, ifIgnore ){

    // 检查当前路径是否为dir
    var _arguments = arguments;
    ifIgnore = ( typeof ifIgnore === 'undefined' ) ? true : ifIgnore;

    // 检查是否为目录
    fs.stat( dir, function ( err, stats ){

        if( err ){

            _errorHandle( err );
            next( err );
            return;
        }

        // 如果为目录
        if( stats.isDirectory() ){

            next( undefined, dir, true );

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

                            var subPath = ( dir[ dir.length - 1 ] === '/' ) ? ( dir + path ) : ( dir + '/' + path );
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
 * @param dir
 * @param next function( ifDir, path, cur, pre )
 */
function watchDir( dir, next ){

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

                _watchDir( path, next );
            }
        }
    });
}

/**
 * 监听单个文件
 * @param path
 * @param next
 * @private
 */
function _watchFile( path, next ){

    if( !( path in WatchList ) && WatchList[ path ] !== true ){

        console.log( 'watch file: ' + path );

        fs.watchFile( path, function ( cur, pre ){

            // 只有当文件被更改时才触发回调
            if( cur.ino != pre.ino ){

                console.log( 'File: %s changed！Time：%s', path, String( new Date() ) );
                next( false, path, cur, pre );
            }

        });

        WatchList[ path ] = true;
    }
}

/**
 * 监听目录
 * @param path
 * @param next
 * @private
 */
function _watchDir( path, next ){

    if( !( path in WatchList ) && WatchList[ path ] !== true ){

        console.log( 'watch directory:' + path );

        fs.watch( path, function (){

            console.log( 'directory: %s changed!', path, String( new Date() ) );
            watchDir( path, next );
            next( true, path );
        });

        WatchList[ path ] = true;
    }
}

/**
 * 错误统一处理
 */
function _errorHandle( err ){

    console.log( err );
    var errCode = err.code;
    var path;

    switch( errCode ){

        case 'ENOENT': {

            // 目录被删除将出发该错误，借此可以解决一个目录被删除，又创建一个同名目录后，对新创建的目录进行监听的效果
            path = err.path;
            delete WatchList[ path ];
            break;
        }
        default: {
            break;
        }
    }
}

exports.watchDir = watchDir;
exports.readDir = readDir;
