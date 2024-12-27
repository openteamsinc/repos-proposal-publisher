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

var checklist = {}
const proposalTitleRequired = "Proposal Title is required.";
const proposalTitleLength = "Proposal Title must be less than 20 words.";
const proposalTitleUnique = "Proposal Title must be unique.";
const proposalTaglineLength = "Proposal Tagline must be less than 160 characters.";
const requestedFundingAmountInt = "Requested funding amount must be an integer.";
const organizationWillingToSponsorRequired = "Organization willing to sponsor is required. Kindly provide a response in Yes or No.";
const existingOssProjectRequired = "Is it an existing OSS project is required. Kindly provide a response in Yes or No.";
const authorRequired = "Author is required.";
const authorUserOnRepos = "Author must be a user on REPOS.";
const projectDescriptionRequired = "Project Description is required. Please provide it in minimum 50 words.";
const projectDescriptionLength = "Project Description must be more than 50 words.";
const projectDetailsRequired = "Project Details & Specifications are required. Please provide it in minimum 50 words.";
const projectDetailsLength = "Project Details & Specifications must be more than 50 words.";
const projectStagesRequired = "Project Stages are required. Phase 1 and Phase 2 are mandatory.";
const phase1Length = "Phase 1 must be more than 20 words.";
const phase2Length = "Phase 2 must be more than 20 words.";
const titleModerationPassed = "Proposal Title moderation passed.";
const taglineModerationPassed = "Proposal Tagline moderation passed.";
const projectDescriptionModerationPassed = "Project Description moderation passed.";
const projectDetailsModerationPassed = "Project Details & Specifications moderation passed.";
const phase1ModerationPassed = "Phase 1 moderation passed.";
const phase2ModerationPassed = "Phase 2 moderation passed.";
const supportingInfoModerationPassed = "Supporting Information moderation passed.";

checklist[proposalTitleRequired] = true;
checklist[proposalTitleLength] = true;
checklist[proposalTitleUnique] = true;
checklist[proposalTaglineLength] = true;
checklist[requestedFundingAmountInt] = true;
checklist[organizationWillingToSponsorRequired] = true;
checklist[existingOssProjectRequired] = true;
checklist[authorRequired] = true;
checklist[authorUserOnRepos] = true;
checklist[projectDescriptionRequired] = true;
checklist[projectDescriptionLength] = true;
checklist[projectDetailsRequired] = true;
checklist[projectDetailsLength] = true;
checklist[projectStagesRequired] = true;
checklist[phase1Length] = true;
checklist[phase2Length] = true;
checklist[titleModerationPassed] = true;
checklist[taglineModerationPassed] = true;
checklist[projectDescriptionModerationPassed] = true;
checklist[projectDetailsModerationPassed] = true;
checklist[phase1ModerationPassed] = true;
checklist[phase2ModerationPassed] = true;
checklist[supportingInfoModerationPassed] = true;

let proposalList = {};
const githubRepositoryUrl = GITHUB_REPOSITORY ? `https://github.com/${GITHUB_REPOSITORY}` : null;
const githubDefaultBranch = GITHUB_REF ? GITHUB_REF.split('/').pop() : null;
const latestCommitId = GITHUB_SHA || null;
const bypassProcess = GITHUB_REPOSITORY !== "openteamsinc/repos-proposal-publisher";

async function checkTitle(title) {
  const response = await axios.get(`${API_URI}check_title?title=${title}`);
  return response?.data?.unique;
}

async function checkUsername(username) {
  const response = await axios.get(`${API_URI}check_username?username=${username.replace(/^@/, '')}`);
  return response?.data?.exists;
}

async function checkProposalOnRepos(pid) {
  const response = await axios.get(`${API_URI}check_proposal?pid=${pid}`);
  if (response.status === 200) {
    return response?.data;
  }
  return null;
}

function readProposalFolder() {
  const proposalPath = path.join(process.env.GITHUB_WORKSPACE || __dirname, 'proposals');
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
  console.log("Fetching sections from the proposal.....");

  content = content.replace(/<!--.*?-->/gs, '');

  const projectDescriptionPattern = /## Project Description\s*([\s\S]*?)\s*## Project Details & Specifications/;
  const projectDetailsPattern = /## Project Details & Specifications\s*([\s\S]*?)\s*## Project Stages/;
  const projectStagesPattern = /## Project Stages\s*([\s\S]*?)\s*## Supporting Information/;
  const supportingInfoPattern = /## Supporting Information\s*([\s\S]*?)$/;

  const projectDescription = content.match(projectDescriptionPattern);
  const projectDetails = content.match(projectDetailsPattern);
  const projectStages = content.match(projectStagesPattern);
  const supportingInfo = content.match(supportingInfoPattern);

  const phasesPattern = /### (Phase \d+)\s*([\s\S]*?)\s*(?=### Phase \d+|$)/g;
  const phasesMatches = projectStages ? [...projectStages[1].matchAll(phasesPattern)] : [];
  const phases = Object.fromEntries(phasesMatches.map(match => [match[1], match[2].trim()]));

  return {
    project_description: projectDescription ? projectDescription[1].trim() : '',
    project_details: projectDetails ? projectDetails[1].trim() : '',
    project_stages: phases,
    supporting_info: supportingInfo ? supportingInfo[1].trim() : '',
  };
}

async function validateProposal(
  oldProposalData, pid, title, tagline, requestedFundingAmount,
  organizationWillingToSponsor, existingOssProject, author,
  description, details, projectStages, extraInformation) {
  console.log("Performing validations on the proposal.....");

  console.log("Validating Title.....");
  if (bypassProcess) {
    if (title) {
      console.log("Title is present so validating it.....");
      if (pid && oldProposalData && oldProposalData.title === title) {
        console.log("Title is same as the previous one. So skipping the check.");
        checklist[proposalTitleUnique] = true;
      } else {
        console.log("Title is not same as the previous one. So checking it's uniqueness.");
        const response = await checkTitle(title);
        console.log(`Title is ${response ? "unique" : "not unique"}.`);
        checklist[proposalTitleUnique] = response;
        if (title.split(' ').length > 20) {
          console.log("Title is more than 20 words.");
          checklist[proposalTitleLength] = false;
        }
      }
    } else {
      console.log("Title is not present.");
      checklist[proposalTitleRequired] = false;
      checklist[proposalTitleLength] = false;
      checklist[proposalTitleUnique] = false;
      checklist[titleModerationPassed] = false;
    }
  }

  console.log("Validating Tagline.....");
  if (tagline) {
    console.log("Tagline is present so validating it.....");
    if (tagline.length > 160) {
      console.log("Tagline is more than 160 characters.");
      checklist[proposalTaglineLength] = false;
    }
  } else {
    console.log("Tagline is not present.");
    delete checklist[proposalTaglineLength];
    delete checklist[taglineModerationPassed];
  }


  console.log("Validating Requested Funding Amount.....");
  if (requestedFundingAmount && isNaN(requestedFundingAmount)) {
    console.log("Requested funding amount is not an integer.");
    checklist[requestedFundingAmountInt] = false;
  }

  console.log("Validating Organization Willing to Sponsor.....");
  if (!["Yes", "No"].includes(organizationWillingToSponsor)) {
    console.log("Organization willing to sponsor is required and must be in Yes or No.");
    checklist[organizationWillingToSponsorRequired] = false;
  }

  console.log("Validating Existing OSS Project.....");
  if (!["Yes", "No"].includes(existingOssProject)) {
    console.log("Is it an existing OSS project is required and must be in Yes or No.");
    checklist[existingOssProjectRequired] = false;
  }

  console.log("Validating Author.....");
  if (bypassProcess) {
    if (author) {
      console.log("Author is present so validating it.....");
      const isUsernameValid = await checkUsername(author);
      console.log(`Author is ${isUsernameValid ? "valid" : "invalid"}.`);
      checklist[authorRequired] = isUsernameValid;
    } else {
      console.log("Author is not present.");
      checklist[authorRequired] = false;
      checklist[authorUserOnRepos] = false;
    }
  }

  console.log("Validating Project Description.....");
  if (!description) {
    console.log("Project Description is not present.");
    checklist[projectDescriptionRequired] = false;
    checklist[projectDescriptionLength] = false;
    checklist[projectDescriptionModerationPassed] = false;
  }
  else {
    console.log("Project Description is present so validating it.....");
    if (description.split(' ').length < 50) {
      console.log("Project Description is less than 50 words.");
      checklist[projectDescriptionLength] = false;
    }
    else {
      console.log("Project Description is more than 50 words.");
      checklist[projectDescriptionLength] = true;
    }
  }

  console.log("Validating Project Details & Specifications.....");
  if (!details) {
    console.log("Project Details & Specifications are not present.");
    checklist[projectDetailsRequired] = false;
    checklist[projectDetailsLength] = false;
    checklist[projectDetailsModerationPassed] = false;
  }
  else {
    console.log("Project Details & Specifications are present so validating it.....");
    if (details.split(' ').length < 50) {
      console.log("Project Details & Specifications are less than 50 words.");
      checklist[projectDetailsLength] = false;
    }
    else {
      console.log("Project Details & Specifications are more than 50 words.");
      checklist[projectDetailsLength] = true;
    }
  }

  console.log("Validating Project Stages.....");
  if (!("Phase 1" in projectStages) && !("Phase 2" in projectStages)) {
    console.log("Project Stages are not present.");
    checklist[projectStagesRequired] = false;
    checklist[phase1Length] = false;
    checklist[phase2Length] = false;
    checklist[phase1ModerationPassed] = false;
    checklist[phase2ModerationPassed] = false;
  } else {
    console.log("Project Stages are present so validating it.....");

    if (projectStages["Phase 1"] && projectStages["Phase 1"].split(' ').length < 20) {
      console.log("Phase 1 is less than 20 words.");
      checklist[phase1Length] = false;
    }
    else {
      console.log("Phase 1 is more than 20 words.");
      checklist[phase1Length] = true;
    }

    if (projectStages["Phase 2"] && projectStages["Phase 2"].split(' ').length < 20) {
      console.log("Phase 2 is less than 20 words.");
      checklist[phase2Length] = false;
    }
    else {
      console.log("Phase 2 is more than 20 words.");
      checklist[phase2Length] = true;
    }

    for (const [phase, phaseDescription] of Object.entries(projectStages)) {
      if (!["Phase 1", "Phase 2"].includes(phase) && phaseDescription.split(' ').length < 20) {
        console.log(`${phase} is less than 20 words.`);
        checklist[`${phase} must be more than 20 words.`] = false;
      }
      else {
        console.log(`${phase} is more than 20 words.`);
        checklist[`${phase} must be more than 20 words.`] = true;
      }
    }
  }


  console.log("Validating Supporting Information.....");
  if (!extraInformation) {
    console.log("Supporting information is not present.");
    delete checklist[supportingInfoModerationPassed];
  }
  else {
    console.log("Supporting information is present so validating it.....");
  }

  console.log("Completed validations on the proposal.");
}

async function moderationApiRequest(text) {
  const response = await axios.post(`${API_URI}check_moderation/`, { text });
  return response?.data?.accepted;
}

async function checkModeration(text, moderationMetadata, checklistKey, metadataKey, phaseKey = null) {
  try {
    const response = await moderationApiRequest(text);
    console.log(`Moderation check ${response ? "passed" : "failed"} for ${phaseKey ? phaseKey : metadataKey}.`);
    checklist[checklistKey] = response;
  } catch (error) {
    console.error(`Error during moderation check for ${metadataKey}:`, error.response.data.message);
    checklist[checklistKey] = false;
  }

  if (phaseKey) {
    moderationMetadata[metadataKey][phaseKey] = {
      "passed": checklist[checklistKey],
    };
  } else {
    moderationMetadata[metadataKey] = {
      "passed": checklist[checklistKey],
    };
  }
}

async function moderateText(
  oldProposalData, moderationMetadata, pid, title,
  tagline, description, details, projectStages, extraInformation
) {
  console.log("Performing moderation checks on the proposal.....");

  if (title) {
    console.log("Moderating Title.....");
    if (pid && oldProposalData && (oldProposalData.title !== title || oldProposalData.moderation_metadata.title.passed === false)) {
      console.log("Title is different from the previous one. So checking it's moderation.");
      await checkModeration(title, moderationMetadata, titleModerationPassed, "title");
    } else if (!pid && !oldProposalData) {
      console.log("Title is new. So checking it's moderation.");
      await checkModeration(title, moderationMetadata, titleModerationPassed, "title");
    } else {
      console.log("Title is same as the previous one. So skipping the check.");
    }
  }
  else {
    console.log("Title is not present. So skipping the moderation check.");
    checklist[titleModerationPassed] = false;
  }

  if (tagline) {
    console.log("Moderating Tagline.....");
    if (pid && oldProposalData && (oldProposalData.tagline !== tagline || oldProposalData.moderation_metadata.tagline.passed === false)) {
      console.log("Tagline is different from the previous one. So checking it's moderation.");
      await checkModeration(tagline, moderationMetadata, taglineModerationPassed, "tagline");
    }
    else if (!pid && !oldProposalData) {
      console.log("Tagline is new. So checking it's moderation.");
      await checkModeration(tagline, moderationMetadata, taglineModerationPassed, "tagline");
    }
    else {
      console.log("Tagline is same as the previous one. So skipping the check.");
    }
  }
  else {
    console.log("Tagline is not present. So skipping the moderation check.");
    delete checklist[taglineModerationPassed];
  }

  if (description) {
    console.log("Moderating Project Description.....");
    if (pid && oldProposalData && (oldProposalData.description !== description || oldProposalData.moderation_metadata.description.passed === false)) {
      console.log("Project Description is different from the previous one. So checking it's moderation.");
      await checkModeration(description, moderationMetadata, projectDescriptionModerationPassed, "description");
    }
    else if (!pid && !oldProposalData) {
      console.log("Project Description is new. So checking it's moderation.");
      await checkModeration(description, moderationMetadata, projectDescriptionModerationPassed, "description");
    }
    else {
      console.log("Project Description is same as the previous one. So skipping the check.");
    }
  }
  else {
    console.log("Project Description is not present. So skipping the moderation check.");
    checklist[projectDescriptionModerationPassed] = false;
  }

  if (details) {
    console.log("Moderating Project Details & Specifications.....");
    if (pid && oldProposalData && (oldProposalData.details !== details || oldProposalData.moderation_metadata.details.passed === false)) {
      console.log("Project Details & Specifications are different from the previous one. So checking it's moderation.");
      await checkModeration(details, moderationMetadata, projectDetailsModerationPassed, "details");
    }
    else if (!pid && !oldProposalData) {
      console.log("Project Details & Specifications are new. So checking it's moderation.");
      await checkModeration(details, moderationMetadata, projectDetailsModerationPassed, "details");
    }
    else {
      console.log("Project Details & Specifications are same as the previous one. So skipping the check.");
    }
  }
  else {
    console.log("Project Details & Specifications are not present. So skipping the moderation check.");
    checklist[projectDetailsModerationPassed] = false;
  }

  if (projectStages) {
    console.log("moderationMetadata = ", moderationMetadata);
    if (!moderationMetadata["project_stages"]) {
      console.log("moderationMetadata[project_stages] is not present. So creating it.");
      moderationMetadata["project_stages"] = {};
    }
    console.log('moderationMetadata["project_stages"] = ', moderationMetadata["project_stages"]);
    console.log("Moderating Project Stages.....");
    for (const [phaseKey, phaseContent] of Object.entries(projectStages)) {

      console.log(`Moderating ${phaseKey}.....`);
      if (pid && oldProposalData && (oldProposalData.project_stages[phaseKey] !== phaseContent || oldProposalData.moderation_metadata.project_stages[phaseKey].passed === false)) {
        console.log(`${phaseKey} is different from the previous one. So checking it's moderation.`);
        await checkModeration(phaseContent, moderationMetadata, `${phaseKey} moderation passed.`, "project_stages", phaseKey);
      }
      else if (!pid && !oldProposalData) {
        console.log(`${phaseKey} is new. So checking it's moderation.`);
        await checkModeration(phaseContent, moderationMetadata, `${phaseKey} moderation passed.`, "project_stages", phaseKey);
      }
      else {
        console.log(`${phaseKey} is same as the previous one. So skipping the check.`);
      }
    }
  }
  else {
    console.log("Project Stages are not present. So skipping the moderation check.");
    checklist[projectStagesRequired] = false;
    checklist[phase1ModerationPassed] = false;
    checklist[phase2ModerationPassed] = false;
  }

  if (extraInformation) {
    console.log("Moderating Supporting Information");
    if (pid && oldProposalData && (oldProposalData.extra_information !== extraInformation || oldProposalData.moderation_metadata.extra_information.passed === false)) {
      console.log("Supporting Information is different from the previous one. So checking it's moderation.");
      await checkModeration(extraInformation, moderationMetadata, supportingInfoModerationPassed, "extra_information");
    }
    else if (!pid && !oldProposalData) {
      console.log("Supporting Information is new. So checking it's moderation.");
      await checkModeration(extraInformation, moderationMetadata, supportingInfoModerationPassed, "extra_information");
    }
    else {
      console.log("Supporting Information is same as the previous one. So skipping the check.");
    }
  }

  console.log("Completed Moderation on the proposal.");
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
    let moderationMetadata = {};
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
      moderationMetadata = oldProposalData?.moderation_metadata || {};
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
      moderationMetadata,
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

    const allChecksPassed = Object.values(checklist).every(Boolean);
    const anyModerationFailed = Object.entries(checklist).some(([key, value]) => key.includes('moderation') && !value);

    if (allChecksPassed) {
      payload["status"] = "Published";
      moderationMetadata["retry"] = 0;
    } else if (anyModerationFailed && moderationMetadata.retry === 2) {
      payload["status"] = "Under Review";
    } else {
      payload["status"] = "Draft";
      if (anyModerationFailed) {
        moderationMetadata["retry"] = moderationMetadata["retry"] ? moderationMetadata["retry"] + 1 : 1;
      }
    }

    if (moderationMetadata) {
      payload["moderation_metadata"] = moderationMetadata;
    }

    proposalList[path.basename(proposalPath)] = {
      payload,
      checklist,
      path: proposalPath,
    };

    if (oldProposalData) {
      proposalList[path.basename(proposalPath)]["oldProposalData"] = oldProposalData;
    };

  }

  for (const [filename, proposalData] of Object.entries(proposalList)) {

    if (!Object.values(proposalData.checklist).every(Boolean) && proposalData.payload["status"] !== "Published") {
      console.log(`Proposal for ${filename} has some to failed checks. So it is currently set as ${proposalData.payload["status"]} status on REPOS. Kindly fix the issues.`);
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
      else {
        console.log("Failed to submit proposal for ", filename);
      }
    }
  }

  console.log("=".repeat(100));
  console.log("Completed processing proposals.");
}

main().catch(error => {
  core.setFailed(error.message);
});
