/**
 * Created by linyong on 9/21/16.
 * @flow
 */
import cluster from 'cluster';
import os from 'os';


class Runner {
  cluster:any;
  numCPUs:number;
  workers:any;
  count:number;
  servers:any;

  constructor(servers:any) {
    this.cluster = cluster;
    this.numCPUs = os.cpus().length;
    this.workers = {};
    this.count = 0;
    this.servers = servers;
  }

  run() {
    const _this = this;
    // 当主进程被终止时，关闭所有工作进程
    process.on('SIGTERM', function () {
      console.log('主进程死亡！');
      for (let pid in _this.workers) {
        process.kill(pid);
      }
      process.exit(0);
    });

    /*process.on('exit', function() {
     console.error('服务器发生异常，导致退出！');
     });*/

    if (_this.cluster.isMaster) {
      console.log(' 主进程-> ' + "启动主进程...");
      let count = 0; //访问次数计数
      for (let i = 0; i < _this.numCPUs; i++) {
        var worker = _this.cluster.fork();
        _this.workers[worker.pid] = worker;
        worker.on('error', function (err) {
          console.error(err);
        });
        worker.on('exit', function (code, signal) {
          if (signal) {
            console.log("worker " + worker.pid + " was killed by signal: " + signal);
          } else if (code !== 0) {
            console.log("worker " + worker.pid + " exited with error code: " + code);
          } else {
            console.log("worker success!");
          }
        });
        //worker.send('111111');//向子进程发送消息
        //监听进程发送的消息！
        worker.on('message', function (msg) {
          if (msg && typeof(msg) === 'object' && msg.count) {
            count++;
            console.log('当前服务器总访问次数：' + count);
          }
        });

      }

      _this.cluster.on('fork', function (worker) {
        console.log(' 主进程-> ' + '创建子进程:' + worker.id);
      });
      _this.cluster.on('online', function (worker) {
        console.log(' 主进程-> ' + '子进程:' + worker.id + '已经创建成功！');
      });

      _this.cluster.on('listening', function (worker, address) {
        console.log(' 主进程-> ' + '正在监听子进程: ' + worker.id + ',pid:' + worker.process.pid + ',监听地址:' + address.address + ",监听端口:" + address.port);
      });

      _this.cluster.on('disconnect', function (worker) {
        console.log(' 主进程-> ' + '子进程:' + worker.id + '断开！');
      });

      _this.cluster.on('exit', function (worker, code, signal) {
        console.log(' 主进程-> ' + '子进程:' + worker.id + ' 退出！');
        var exitCode = worker.process.exitCode;
        console.log(' 主进程-> ' + '子进程: ' + worker.process.pid + ' 退出错误码 (' + exitCode + '). 重启中...');
        delete _this.workers[worker.pid];
        worker = _this.cluster.fork();
        _this.workers[worker.pid] = worker;
        worker.on('exit', function (code, signal) {
          if (signal) {
            console.log("子进程被信号终极: " + signal);
          } else if (code !== 0) {
            console.log("退出错误码: " + code);
          } else {
            console.log("子进程启动成功!");
          }
        });

      });
    }
    else if (_this.cluster.isWorker) {
      console.log(' 子进程-> ' + "启动子进程 ..." + _this.cluster.worker.id);
      process.on('message', function (msg) {
        console.log(' 子进程-> ' + msg);
        process.send(' 子进程-> 子进程：' + _this.cluster.worker.id + ' 获取到主进程的消息!');
      });

      process.on('error', function (err) {
        console.error(' 子进程-> ERROR:', err);
      });

      process.on('uncaughtException', function (err) {
        console.error(' 子进程-> uncaughtException:', err);
      });
      _this.servers.map(item => {
        item.run();
      })

    } else {
      console.error('启动发生意外！');
    }
  }
}
export default Runner;
