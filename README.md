# repos-proposal-publisher

This repository is for creation an action for publishing a proposal to REPOS website.

## Usage

For publishing a proposal to REPOS website, you need to create a proposal markdown file in `proposals` folder with the following structure:

**Things to note:**
- Proposal Title: Cannot be empty, must be less than 20 words, unique, and meet Moderation Standards.
- Tagline: Must be less than 160 characters and meet Moderation Standards.
- Requested Funding Amount: Only required if you are looking for sponsor.
- Skills: Only required if you are looking for team members.
- Author: Must be a valid GitHub username, and should have an account on REPOS website.
- Whether the organization is willing to sponsor the project: Yes or No.
- Whether this is an existing OSS project: Yes or No.
- Project Description: Cannot be empty, must meet Moderation Standards, and must be of minimum 50 words.
- Project Details & Specifications: Cannot be empty, must meet Moderation Standards, and must be of minimum 50 words.
- Project Stages: Cannot be empty. Phase 1 and Phase 2 are required. Each phase must meet Moderation Standards and must be of minimum 20 words. You can add more phases if needed.
- Supporting Information: Can be empty, must meet Moderation Standards.


Here is an example of a proposal markdown file:

```yaml
---
Proposal Title: "Demo Proposal"
Tagline: "Demo Tagline for Proposal"
Requested Funding Amount: "10000"
Skills: "Python, Machine Learning, Data Analysis"
Author: "@openteams-psm-assistant"
Is your organization willing to sponsor this project?: "No"
Is this an existing OSS project?: "Yes"
---
<!-- Proposal metadata 
    - Title of the proposal (cannot be empty, must be less than 20 words, unique, and meet Moderation Standards)
    - Short tagline for the proposal (must be less than 160 characters and meet Moderation Standards) 
    - Amount of funding requested (only required if you are looking for sponsor) 
    - List of skills required for the project (only required if you are looking for team members) 
    - Author of the proposal (must be a valid GitHub username, and should have a account on REPOS website) 
    - Whether the organization is willing to sponsor the project (Yes or No) 
    - Whether this is an existing OSS project (Yes or No) 
-->

## Project Description
<!-- Provide a detailed description of the project -->
<!-- 
    1. Project description cannot be empty.
    2. It must meet the Moderation Standards.
    3. It must be of minimum 50 words.
-->
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt


## Project Details & Specifications
<!-- Provide detailed specifications of the project -->
<!-- 
    1. Project details and specifications cannot be empty.
    2. It must meet the Moderation Standards.
    3. It must be of minimum 50 words.
-->
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt


## Project Stages
<!-- Describe the project stages, including phases such as Phase 1, Phase 2, etc. -->
<!-- 
    1. Project stages cannot be empty. Phase 1 and Phase 2 are required.
    2. It must meet the Moderation Standards.
    3. Each phase must be of minimum 20 words.
    4. You can add more phases if needed.
-->
### Phase 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt


### Phase 2

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt


### Phase 3

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt


## Supporting Information
<!-- Provide any additional supporting information -->
<!-- 
    1. Supporting information can be empty.
    2. It must meet the Moderation Standards.
-->
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ac purus sit amet nisl tincidunt tincidunt
```

After creating the proposal markdown file, you need to add GitHub token to the repository secrets with the name `GH_TOKEN`.

Then, you can create a workflow file in `.github/workflows` folder with the following content:

```yaml
name: REPOS Proposal Publisher

on:
  push:
    branches:
      - main

jobs:
    run-action:
        runs-on: ubuntu-latest

        steps:
        - name: Checkout repository
            uses: actions/checkout@v2
    
        - name: Run REPOS Proposal Publisher
            uses: openteamsinc/repos-proposal-publisher@dev
            with:
                token: ${{ secrets.GH_TOKEN }}
```bash