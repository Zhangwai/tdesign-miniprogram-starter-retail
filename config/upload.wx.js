const ci = require('miniprogram-ci');
const { version } = require('../package.json');

(async () => {
  const project = new ci.Project({
    appid: 'wxe8d6b10e0f900650',
    type: 'miniProgram',
    projectPath: `${process.cwd()}`,
    privateKeyPath: `${process.cwd()}/key/private.wxe8d6b10e0f900650.key`,
    ignores: ['node_modules/**/*'],
  });

  // 构建npm
  // const warning = await ci.packNpmManually({
  //   packageJsonPath: `${process.cwd()}/package.json`,
  //   miniprogramNpmDistDir: `${process.cwd()}`,
  // });

  // console.warn(warning);

  ci.upload({
    project,
    version,
    robot: 9,
    desc: `${new Date()}上传`,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
    },
  })
    .then((res) => {
      console.log(res, '上传成功');
    })
    .catch((error) => {
      console.log(error, '上传失败');
      process.exit(-1);
    });
})();
