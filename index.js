const core = require('@actions/core');
const github = require('@actions/github');
const { request } = require('@octokit/request');
const fs = require('fs');

const main = async () => {
    try {
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const pull_number = core.getInput('pull_number', { required: true });
        const token = core.getInput('token', { required: true });
        const url = 'https://training.cleverland.by/pull-request/opened';
        const path_to_tests_report = 'cypress/report/report.json';
        const path_to_tests_screenshots = 'cypress/report/screenshots';
        const minimum_required_result = 80;
        let tests_result_message = '';
        let pass_percent_tests = '';

        const octokit = new github.getOctokit(token);

        fs.readFile(path_to_tests_report, 'utf8', (err, data) => {
            const { stats } = JSON.parse(data);
            const { tests, failures, passPercent } = stats;
            pass_percent_tests = passPercent;

            tests_result_message = '#  Результаты тестов' + '\n' + `Процент пройденных тестов: ${passPercent}%.` + '\n' + `Общее количество тестов: ${tests}.` + '\n' + `Количество непройденных тестов: ${failures}.` + '\n';
        });

        const { data: pull_request_info } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number,
        });

        consol

        // const { data: tests_report } = await octokit.rest.repos.getContent({
        //     owner,
        //     repo,
        //     path: path_to_tests_report,
        //     ref: pull_request_info.head.ref
        // });

        // const { data: tests_screenshots } = await octokit.rest.repos.getContent({
        //     owner,
        //     repo,
        //     path: path_to_tests_screenshots,
        //     ref: pull_request_info.head.ref
        // });

        // const buff = Buffer.from(tests_report.content, 'base64');
        // const { stats: tests_stats } = JSON.parse(buff.toString('utf-8'));
        // const { tests, failures, passPercent } = tests_stats;

        // const createTestsResultMessage = () => {
        //     let tests_result_message = '#  Результаты тестов' + '\n' + `Процент пройденных тестов: ${passPercent}%.` + '\n' + `Общее количество тестов: ${tests}.` + '\n' + `Количество непройденных тестов: ${failures}.` + '\n';
            
        //     tests_screenshots.forEach(({ download_url }) => {
        //         tests_result_message += `![Скриншот](${download_url})` + '\n';
        //     });

        //     return tests_result_message;
        // };

        await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pull_number,
            body: tests_result_message,
        });

        await request(`POST ${url}`, {
            data: { 
                link: pull_request_info.html_url, 
                github: pull_request_info.user.login,
                isTestsSuccess: pass_percent_tests >= minimum_required_result
            },
            headers: {
              'Content-Type': 'application/json;charset=utf-8'
            },
        });

    } catch (error) {
        console.log(error);
        core.setFailed(error.message);
    }
}

// Call the main function to run the action
main();