//@ts-check
const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const Jimp = require('jimp'); 
const path = require('path');

const API_URL = 'https://training.clevertec.ru';

const main = async () => {
  try {
    const owner = core.getInput('owner', { required: true });
    const repo = core.getInput('repo', { required: true });
    const pull_number = core.getInput('pull_number', { required: true });
    const token = core.getInput('token', { required: true });
    const base_url = core.getInput('host', { required: false }) || API_URL;
    const path_to_tests_report = 'cypress/report/report.json';
    const path_to_test_file_name = 'cypress/e2e';
    const minimum_required_result = 100;
    const minimum_result_to_send_screenshots = 100;
    let tests_result_message = '';
    let pass_percent_tests = 0;

    const octokit = github.getOctokit(token);

    const data = await new Promise((resolve, reject) => {
      fs.readFile(path_to_tests_report, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(JSON.parse(data));
      });
    });

    const {
      stats: { tests, failures, passPercent },
    } = data;
    pass_percent_tests = passPercent;

    tests_result_message =
      '# Результаты тестов' +
      '\n' +
      `Процент пройденных тестов: ${Math.trunc(passPercent)}%.` +
      '\n' +
      `Общее количество тестов: ${tests}.` +
      '\n' +
      `Количество непройденных тестов: ${failures}.` +
      '\n';

    const { data: pull_request_info } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: Number(pull_number),
    });

    const test_file_name = fs.readdirSync(path_to_test_file_name)[0];
    const path_to_tests_screenshots = `cypress/report/screenshots/${test_file_name}`;
    const temp_dir = 'cypress/report/screenshots/temp';

    if (!fs.existsSync(temp_dir)) {
      fs.mkdirSync(temp_dir, { recursive: true });
    }

    // Сжимаем скриншоты с помощью Jimp
    const screenshotFiles = fs.readdirSync(path_to_tests_screenshots);
    const compressedScreenshots = await Promise.all(
      screenshotFiles.map(async (screenshot) => {
        const originalPath = path.join(path_to_tests_screenshots, screenshot);
        const compressedPath = path.join(temp_dir, screenshot.replace('.png', '.jpg'));

        const image = await Jimp.read(originalPath);
        await image
          .quality(70)
          .writeAsync(compressedPath);

        return compressedPath;
      })
    );

    const formData = new FormData();
    formData.append('github', pull_request_info.user.login);

    compressedScreenshots.forEach((compressedPath) => {
      formData.append('files', fs.createReadStream(compressedPath));
    });

    const screenshots_links_request_config = {
      method: 'post',
      url: `${base_url}/pull-request/save-images`,
      headers: {
        ...formData.getHeaders(),
      },
      data: formData,
    };

    const { data: screenshots } = await axios(screenshots_links_request_config);

    const createTestsResultMessage = () => {
      if (pass_percent_tests >= minimum_result_to_send_screenshots) {
        screenshots.forEach(({ name, url }) => {
          url = url.replace(/\s+/g, '%20');
          tests_result_message +=
            '***' +
            '\n' +
            `**${name}**` +
            '\n' +
            `![Скриншот автотестов](https://static.clevertec.ru${url})` +
            '\n';
        });
      }

      return tests_result_message;
    };

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: Number(pull_number),
      body: createTestsResultMessage(),
    });

    const tests_result_request_config = {
      method: 'post',
      url: `${base_url}/pull-request/opened`,
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      data: {
        link: pull_request_info.html_url,
        github: pull_request_info.user.login,
        isTestsSuccess: pass_percent_tests >= minimum_required_result,
        pullNumber: pull_number,
      },
    };

    await axios(tests_result_request_config);

    fs.rmSync(temp_dir, { recursive: true, force: true });
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
};

main();
