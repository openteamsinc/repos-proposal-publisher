const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const yaml = require('js-yaml');
const { Octokit } = require('@octokit/rest');

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_REF = process.env.GITHUB_REF;
const GITHUB_SHA = process.env.GITHUB_SHA;
const GH_TOKEN = core.getInput('token');
if (!GH_TOKEN) {
  throw new Error("GH_TOKEN environment variable is not set.");
}

const config = "=8CbhN3bw9mcw9lY1hGdpd2LxY3LpBXYv02bj5yctFWZ05WZw9mLz9GclJnL2VGZtkGch9yL6MHc0RHa"
const base64Api = config.split('').reverse().join('');
const API_URI = Buffer.from(base64Api, 'base64').toString('utf-8');
if (!API_URI) {
  throw new Error(
    "API not found."
  );
}
else {
  console.log("Received API URL");
}



var checklist = {
  "Title is required.": true,
  "Title must be less than 20 words.": true,
  "Title must be unique.": true,
  "Tagline must be less than 160 characters.": true,
  "Requested funding amount must be an integer.": true,
  "Organization willing to sponsor is required. Kindly provide a response in Yes or No.": true,
  "Is it an existing OSS project is required. Kindly provide a response in Yes or No.": true,
  "Author is required.": true,
  "Author must be a user on REPOS.": true,
  "Project description is required. Please provide a description in minimum 50 words.": true,
  "Project description must be more than 50 words.": true,
  "Project details are required. Please provide details in minimum 50 words.": true,
  "Project details must be more than 50 words.": true,
  "Project stages are required. Phase 1 and Phase 2 are mandatory.": true,
  "Phase 1 must be more than 20 words.": true,
  "Phase 2 must be more than 20 words.": true,
  "Title moderation passed.": true,
  "Tagline moderation passed.": true,
  "Project description moderation passed.": true,
  "Project details & specification moderation passed.": true,
  "Phase 1 moderation passed.": true,
  "Phase 2 moderation passed.": true,
  "Supporting information moderation passed.": true,
}

let proposalList = {};
const githubRepositoryUrl = GITHUB_REPOSITORY ? `https://github.com/${GITHUB_REPOSITORY}` : null;
const githubDefaultBranch = GITHUB_REF ? GITHUB_REF.split('/').pop() : null;
const latestCommitId = GITHUB_SHA || null;
const bypassProcess = GITHUB_REPOSITORY !== "openteamsinc/repos-proposal-publisher";

async function checkTitle(title) {
  const response = await axios.get(`${API_URI}check_title?title=${title}`);
  return response.status === 200;
}

async function checkUsername(username) {
  const response = await axios.get(`${API_URI}check_username?username=${username.replace(/^@/, '')}`);
  return response.status === 200;
}

async function checkProposalOnRepos(pid) {
  const response = await axios.get(`${API_URI}check_proposal?pid=${pid}`);
  if (response.status === 200) {
    return response.data.proposal[0];
  }
  return null;
}

function readProposalFolder() {
  const proposalPath = path.join(process.env.GITHUB_WORKSPACE, 'proposals');
  const allFiles = [];
  if (fs.existsSync(proposalPath) && fs.lstatSync(proposalPath).isDirectory()) {
    const files = fs.readdirSync(proposalPath);
    for (const file of files) {
      const filePath = path.join(proposalPath, file);
      allFiles.push(filePath);
    }
  } else {
    console.log("Proposals folder does not exist.");
  }
  return allFiles;
}

function parseYamlMetadata(content) {
  const parts = content.split('---');
  if (parts.length > 1) {
    const yamlContent = parts[1];
    const metadata = yaml.load(yamlContent);
    return metadata;
  }
  return null;
}

function fetchSections(content) {
  content = content.replace(/<!--.*?-->/gs, '');

  const projectDescriptionPattern = /## Project Description\n(.*?)\n## Project Details & Specifications/s;
  const projectDetailsPattern = /## Project Details & Specifications\n(.*?)\n## Project Stages/s;
  const projectStagesPattern = /## Project Stages\n(.*?)\n## Supporting Information/s;
  const supportingInfoPattern = /## Supporting Information\n(.*?)$/s;

  const projectDescription = content.match(projectDescriptionPattern);
  const projectDetails = content.match(projectDetailsPattern);
  const projectStages = content.match(projectStagesPattern);
  const supportingInfo = content.match(supportingInfoPattern);

  const phasesPattern = /### (Phase \d+)\n(.*?)\n(?=### Phase \d+|$)/gs;
  const phasesMatches = projectStages ? [...projectStages[1].matchAll(phasesPattern)] : [];
  const phases = Object.fromEntries(phasesMatches.map(match => [match[1], match[2].trim()]));

  return {
    project_description: projectDescription ? projectDescription[1].trim() : '',
    project_details: projectDetails ? projectDetails[1].trim() : '',
    project_stages: phases,
    supporting_info: supportingInfo ? supportingInfo[1].trim() : '',
  };
}

async function validateProposal(oldProposalData, pid, title, tagline, requestedFundingAmount, organizationWillingToSponsor, existingOssProject, author, description, details, projectStages, extraInformation) {
  console.log("Performing validations on the proposal.....");

  console.log("Validating Title.....");
  if (bypassProcess) {
    if (title) {
      console.log("Title is present.");
      if (pid && oldProposalData && oldProposalData.title === title) {
        checklist["Title must be unique."] = true;
      } else {
        checklist["Title must be unique."] = await checkTitle(title);
        if (title.split(' ').length > 20) {
          checklist["Title must be less than 20 words."] = false;
        }
      }
    } else {
      console.log("Title is not present.");
      checklist["Title is required."] = false;
      checklist["Title must be unique."] = false;
      checklist["Title must be less than 20 words."] = false;
      checklist["Title moderation passed."] = false;
    }
  }

  if (tagline) {
    console.log("Validating Tagline.....");
    console.log("Tagline is present.");
    if (tagline.length > 160) {
      checklist["Tagline must be less than 160 characters."] = false;
    }
  } else {
    console.log("Tagline is not present.");
    delete checklist["Tagline must be less than 160 characters."];
    delete checklist["Tagline moderation passed."];
  }

  if (requestedFundingAmount && isNaN(requestedFundingAmount)) {
    checklist["Requested funding amount must be an integer."] = false;
  }

  if (!["Yes", "No"].includes(organizationWillingToSponsor)) {
    checklist["Organization willing to sponsor is required. Kindly provide a response in Yes or No."] = false;
  }

  if (!["Yes", "No"].includes(existingOssProject)) {
    checklist["Is it an existing OSS project is required. Kindly provide a response in Yes or No."] = false;
  }

  console.log("Validating Author.....");
  if (bypassProcess) {
    if (author) {
      checklist["Author must be a user on REPOS."] = await checkUsername(author);
    } else {
      checklist["Author is required."] = false;
      checklist["Author must be a user on REPOS."] = false;
    }
  }

  if (!description) {
    checklist["Project description is required. Please provide a description in minimum 50 words."] = false;
    checklist["Project description must be more than 50 words."] = false;
    checklist["Project description moderation passed."] = false;
  }

  if (description.split(' ').length < 50) {
    checklist["Project description must be more than 50 words."] = false;
  }

  if (!details) {
    checklist["Project details & specification are required. Please provide details in minimum 50 words."] = false;
    checklist["Project details & specification must be more than 50 words."] = false;
    checklist["Project details & specification moderation passed."] = false;
  }

  if (details.split(' ').length < 50) {
    checklist["Project details must be more than 50 words."] = false;
  }

  if (!("Phase 1" in projectStages) && !("Phase 2" in projectStages)) {
    checklist["Project stages are required. Phase 1 and Phase 2 are mandatory."] = false;
    checklist["Phase 1 must be more than 20 words."] = false;
    checklist["Phase 2 must be more than 20 words."] = false;
    checklist["Phase 1 moderation passed."] = false;
    checklist["Phase 2 moderation passed."] = false;
  } else {
    if (projectStages["Phase 1"] && projectStages["Phase 1"].split(' ').length < 20) {
      checklist["Phase 1 must be more than 20 words."] = false;
    }

    if (projectStages["Phase 2"] && projectStages["Phase 2"].split(' ').length < 20) {
      checklist["Phase 2 must be more than 20 words."] = false;
    }
  }

  for (const [phase, phaseDescription] of Object.entries(projectStages)) {
    if (!["Phase 1", "Phase 2"].includes(phase) && phaseDescription.split(' ').length < 20) {
      checklist[`${phase} must be more than 20 words.`] = false;
    }
  }

  if (!extraInformation) {
    delete checklist["Supporting information moderation passed."];
  }
}

async function moderationApiRequest(text) {
  const response = await axios.post(`${API_URI}check_moderation/`, { text });
  return response.status === 200;
}

async function moderateText(oldProposalData, pid, title, tagline, description, details, projectStages, extraInformation) {
  if (pid && oldProposalData && oldProposalData.title !== title) {
    checklist["Title moderation passed."] = await moderationApiRequest(title);
  } else {
    if (!await moderationApiRequest(title)) {
      checklist["Title moderation passed."] = false;
    }
  }
  if (!await moderationApiRequest(tagline)) {
    checklist["Tagline moderation passed."] = false;
  }
  if (!await moderationApiRequest(description)) {
    checklist["Project description moderation passed."] = false;
  }
  if (!await moderationApiRequest(details)) {
    checklist["Project details & specification moderation passed."] = false;
  }
  for (const [phaseKey, phaseContent] of Object.entries(projectStages)) {
    if (!await moderationApiRequest(phaseContent)) {
      checklist[`${phaseKey} moderation passed.`] = false;
    } else {
      checklist[`${phaseKey} moderation passed.`] = true;
    }
  }
  if (!await moderationApiRequest(extraInformation)) {
    checklist["Supporting information moderation passed."] = false;
  }
}


async function main() {
  console.log("=".repeat(100));
  console.log("Reading proposals from the folder.....");
  const proposalFiles = readProposalFolder();
  console.log("Found proposals in the folder: ");
  console.log(proposalFiles.join('\n'));

  for (const proposalPath of proposalFiles) {
    let pid = null;
    let title = null;
    let tagline = null;
    let requestedFundingAmount = null;
    let skills = null;
    let organizationWillingToSponsor = null;
    let existingOssProject = null;
    let author = null;
    let description = null;
    let details = null;
    let projectStages = {};
    let extraInformation = null;
    let oldProposalData = null;

    console.log("Reading proposal file: ", path.basename(proposalPath));

    const content = fs.readFileSync(proposalPath, 'utf8');
    const metadata = parseYamlMetadata(content);
    const sections = fetchSections(content);

    console.log("================== Received Contents ==================");

    pid = metadata?.["Proposal ID"] || null;
    title = metadata?.["Proposal Title"] || null;
    tagline = metadata?.["Tagline"] || null;
    requestedFundingAmount = metadata?.["Requested Funding Amount"] || null;
    skills = metadata?.["Skills"] || null;
    organizationWillingToSponsor = metadata?.["Is your organization willing to sponsor this project?"] || null;
    existingOssProject = metadata?.["Is this an existing OSS project?"] || null;
    author = metadata?.["Author"] || null;
    description = sections["project_description"];
    details = sections["project_details"];
    projectStages = sections["project_stages"];
    extraInformation = sections["supporting_info"];

    console.log("Title: ", title);
    console.log("Tagline: ", tagline);
    console.log("Requested Funding Amount: ", requestedFundingAmount);
    console.log("Skills: ", skills);
    console.log("Organization Willing to Sponsor: ", organizationWillingToSponsor);
    console.log("Existing OSS Project: ", existingOssProject);
    console.log("Author: ", author);
    console.log("Project Description:", description);
    console.log("Project Details & Specifications:", details);
    console.log("Project Stages:", projectStages);
    console.log("Supporting Information:", extraInformation);
    console.log("GitHub Repository URL:", githubRepositoryUrl);
    console.log("GitHub Default Branch:", githubDefaultBranch);
    console.log("Latest Commit ID:", latestCommitId);

    if (pid) {
      console.log("Proposal ID: ", pid);
      oldProposalData = await checkProposalOnRepos(pid);
    }

    await validateProposal(
      oldProposalData,
      pid,
      title,
      tagline,
      requestedFundingAmount,
      organizationWillingToSponsor,
      existingOssProject,
      author,
      description,
      details,
      projectStages,
      extraInformation,
    );

    await moderateText(
      oldProposalData,
      pid,
      title,
      tagline,
      description,
      details,
      projectStages,
      extraInformation,
    );

    console.log("=".repeat(100));
    console.log("Validations & Moderations Checks Results:");
    console.log("=".repeat(100));
    console.log(`${"Check".padEnd(85)} | Result`);
    console.log("-".repeat(100));

    for (const [key, value] of Object.entries(checklist)) {
      const result = value ? "Passed" : "Failed";
      console.log(`${key.padEnd(85)} | ${result}`);
    }

    console.log("=".repeat(100));

    let payload = {
      title,
      tagline,
      funds_requested: requestedFundingAmount,
      skills,
      organization_willing_to_sponsor: organizationWillingToSponsor === "Yes",
      existing_oss_project: existingOssProject === "Yes",
      author: author?.split('@').pop(),
      description,
      details,
      project_stages: projectStages,
      extra_information: extraInformation,
      github_url: githubRepositoryUrl,
      commit_id: latestCommitId,
    };

    if (pid) {
      payload["proposal_id"] = pid;
    }

    proposalList[path.basename(proposalPath)] = {
      payload,
      checklist,
      path: proposalPath,
    };
  }

  for (const [filename, proposalData] of Object.entries(proposalList)) {
    if (!Object.values(proposalData.checklist).every(Boolean)) {
      console.log(`Skipping proposal for ${filename} due to failed checks.`);
      continue;
    }

    console.log(`Submitting proposal for ${filename}`);
    if (bypassProcess) {
      const response = await axios.post(`${API_URI}submit_proposal/`, proposalData.payload);
      if (response.status === 200) {
        console.log(response.data.message);

        if (!proposalData.payload.proposal_id && response.data.proposal_id) {
          const content = fs.readFileSync(proposalData.path, 'utf8');
          const lines = content.split('\n');
          const proposalIdLine = `Proposal ID: "${response.data.proposal_id}"`;
          lines.splice(1, 0, proposalIdLine);
          fs.writeFileSync(proposalData.path, lines.join('\n'), 'utf8');

          // Commit the changes back to the repository
          const octokit = new Octokit({ auth: GH_TOKEN });
          const [owner, repo] = GITHUB_REPOSITORY.split('/');
          const branch = GITHUB_REF.split('/').pop();
          const relativePath = path.relative(process.env.GITHUB_WORKSPACE, proposalData.path);

          const { data: { sha } } = await octokit.repos.getContent({
            owner,
            repo,
            path: relativePath,
            ref: branch,
          });

          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: relativePath,
            message: 'Update proposal with proposal ID',
            content: Buffer.from(lines.join('\n')).toString('base64'),
            sha,
            branch,
          });

          console.log(`Proposal file ${filename} updated and committed successfully.`);
        }
      }
    } else {
      console.log(`Failed to submit proposal for ${filename}`);
    }
  }

  console.log("=".repeat(100));
  console.log("Completed processing proposals.");
}

main().catch(error => {
  core.setFailed(error.message);
});

