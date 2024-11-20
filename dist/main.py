import os
import re

import requests
import yaml

API_URL = os.getenv("API_URL")
GH_TOKEN = os.getenv("GH_TOKEN")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY")

if not API_URL:
    raise ValueError("API_URL environment variable is not set.")

if not GH_TOKEN:
    raise ValueError("GH_TOKEN environment variable is not set.")


HEADER = {
    "Authorization": f"Bearer {GH_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


checklist = {
    "Title is required.": True,
    "Title must be less than 20 words.": True,
    "Title must be unique.": True,
    "Tagline must be less than 160 characters.": True,
    "Requested funding amount must be an integer.": True,
    "Organization willing to sponsor is required. Kindly provide a response in Yes or No.": True,
    "Is it an existing OSS project is required. Kindly provide a response in Yes or No.": True,
    "Author is required.": True,
    "Author must be a user on REPOS.": True,
    "Project description is required. Please provide a description in minimum 50 words.": True,
    "Project description must be more than 50 words.": True,
    "Project details are required. Please provide details in minimum 50 words.": True,
    "Project details must be more than 50 words.": True,
    "Project stages are required. Phase 1 and Phase 2 are mandatory.": True,
    "Phase 1 must be more than 20 words.": True,
    "Phase 2 must be more than 20 words.": True,
    "Title moderation passed.": True,
    "Tagline moderation passed.": True,
    "Project description moderation passed.": True,
    "Project details & specification moderation passed.": True,
    "Phase 1 moderation passed.": True,
    "Phase 2 moderation passed.": True,
    "Supporting information moderation passed.": True,
}


def get_repository_details() -> tuple[str, str]:
    api_url = f"https://api.github.com/repos/{GITHUB_REPOSITORY}"
    response = requests.get(api_url, headers=HEADER)
    if response.status_code == 200:
        repo_data = response.json()
        return repo_data["html_url"], repo_data["default_branch"]
    else:
        raise Exception(f"Failed to fetch repository details: {response.status_code}")


def get_latest_commit_id(branch: str) -> str:
    api_url = f"https://api.github.com/repos/{GITHUB_REPOSITORY}/commits/{branch}"
    response = requests.get(api_url, headers=HEADER)
    if response.status_code == 200:
        commit_data = response.json()
        return commit_data["sha"]
    else:
        raise Exception(f"Failed to fetch commit details: {response.status_code}")


def read_proposal_folder() -> list[str]:
    # Define the path to the proposal folder
    proposal_path = os.path.join(os.getcwd(), "proposals")
    all_files = []
    # Check if the folder exists
    if os.path.exists(proposal_path) and os.path.isdir(proposal_path):
        # List all files in the proposal folder
        files = os.listdir(proposal_path)
        for file in files:
            file_path = os.path.join(proposal_path, file)
            all_files.append(file_path)
    else:
        print("Proposals folder does not exist.")

    return all_files


def parse_yaml_metadata(content: str) -> dict:
    parts = content.split("---")
    if len(parts) > 1:
        yaml_content = parts[1]
        metadata = yaml.safe_load(yaml_content)
        return metadata
    return None


def fetch_sections(content: str) -> dict:
    # Remove commented lines
    content = re.sub(r"<!--.*?-->", "", content, flags=re.DOTALL)

    # Define regex patterns for each section
    project_description_pattern = (
        r"## Project Description\n(.*?)\n## Project Details & Specifications"
    )
    project_details_pattern = (
        r"## Project Details & Specifications\n(.*?)\n## Project Stages"
    )
    project_stages_pattern = r"## Project Stages\n(.*?)\n## Supporting Information"
    supporting_info_pattern = r"## Supporting Information\n(.*?)$"

    # Extract sections using regex
    project_description = re.search(project_description_pattern, content, re.DOTALL)
    project_details = re.search(project_details_pattern, content, re.DOTALL)
    project_stages = re.search(project_stages_pattern, content, re.DOTALL)
    supporting_info = re.search(supporting_info_pattern, content, re.DOTALL)

    # Extract phases from project stages
    phases_pattern = r"### (Phase \d+)\n(.*?)\n(?=### Phase \d+|$)"
    phases_matches = (
        re.findall(phases_pattern, project_stages.group(1), re.DOTALL)
        if project_stages
        else []
    )
    phases = {phase: content.strip() for phase, content in phases_matches}

    return {
        "project_description": (
            project_description.group(1).strip() if project_description else ""
        ),
        "project_details": project_details.group(1).strip() if project_details else "",
        "project_stages": phases,
        "supporting_info": supporting_info.group(1).strip() if supporting_info else "",
    }


def validate_proposal(
    title: str,
    tagline: str,
    requested_funding_amount: str,
    organization_willing_to_sponsor: str,
    existing_oss_project: str,
    author: str,
    description: str,
    details: str,
    project_stages: dict,
    extra_information: str,
):

    if not title:
        checklist["Title is required."] = False
        checklist["Title must be unique."] = False
        checklist["Title must be less than 20 words."] = False
        checklist["Title moderation passed."] = False

    if title:
        response = requests.get(f"{API_URL}check_title?title={title}")
        if response.status_code != 200:
            checklist["Title must be unique."] = False

    if len(title.split(" ")) > 20:
        checklist["Title must be less than 20 words."] = False

    if not tagline:
        del checklist["Tagline must be less than 160 characters."]
        del checklist["Tagline moderation passed."]

    if len(tagline) > 160:
        checklist["Tagline must be less than 160 characters."] = False

    if requested_funding_amount and not requested_funding_amount.isdigit():
        checklist["Requested funding amount must be an integer."] = False

    if organization_willing_to_sponsor not in ["Yes", "No"]:
        checklist[
            "Organization willing to sponsor is required. Kindly provide a response in Yes or No."
        ] = False

    if existing_oss_project not in ["Yes", "No"]:
        checklist[
            "Is it an existing OSS project is required. Kindly provide a response in Yes or No."
        ] = False

    if not author:
        checklist["Author is required."] = False

    if author:
        response = requests.get(
            f"{API_URL}check_username?username={author.lstrip('@')}"
        )
        if response.status_code != 200:
            checklist["Author must be a user on REPOS."] = False

    if not description:
        checklist[
            "Project description is required. Please provide a description in minimum 50 words."
        ] = False
        checklist["Project description must be more than 50 words."] = False
        checklist["Project description moderation passed."] = False

    if len(description.split(" ")) < 50:
        checklist["Project description must be more than 50 words."] = False

    if not details:
        checklist[
            "Project details & specification are required. Please provide details in minimum 50 words."
        ] = False
        checklist["Project details & specification must be more than 50 words."] = False
        checklist["Project details & specification moderation passed."] = False

    if len(details.split(" ")) < 50:
        checklist["Project details must be more than 50 words."] = False

    if (
        "Phase 1" not in project_stages.keys()
        and "Phase 2" not in project_stages.keys()
    ):
        checklist["Project stages are required. Phase 1 and Phase 2 are mandatory."] = (
            False
        )
        checklist["Phase 1 must be more than 20 words."] = False
        checklist["Phase 2 must be more than 20 words."] = False
        checklist["Phase 1 moderation passed."] = False
        checklist["Phase 2 moderation passed."] = False

    if len(project_stages["Phase 1"].split(" ")) < 20:
        checklist["Phase 1 must be more than 20 words."] = False

    if len(project_stages["Phase 2"].split(" ")) < 20:
        checklist["Phase 2 must be more than 20 words."] = False

    if not extra_information:
        del checklist["Supporting information moderation passed."]


def moderation_api_request(text: str) -> bool:
    response = requests.post(f"{API_URL}check_moderation/", data={"text": text})
    return True if response.status_code == 200 else False


def moderate_text(
    title: str,
    tagline: str,
    description: str,
    details: str,
    project_stages: str,
    extra_information: str,
) -> None:
    if not moderation_api_request(title):
        checklist["Title moderation passed."] = False
    if not moderation_api_request(tagline):
        checklist["Tagline moderation passed."] = False
    if not moderation_api_request(description):
        checklist["Project description moderation passed."] = False
    if not moderation_api_request(details):
        checklist["Project details & specification moderation passed."] = False
    for phase_key, phase_content in project_stages.items():
        if not moderation_api_request(phase_content):
            checklist[f"{phase_key} moderation passed."] = False
    if not moderation_api_request(extra_information):
        checklist["Supporting information moderation passed."] = False


def main():

    title = None
    tagline = None
    requested_funding_amount = None
    skills = None
    organization_willing_to_sponsor = None
    existing_oss_project = None
    author = None
    description = None
    details = None
    project_stages = {}
    extra_information = None

    repo_url, default_branch = get_repository_details()
    latest_commit_id = get_latest_commit_id(default_branch)

    # Read the proposal file
    proposal_files = read_proposal_folder()
    for proposal_path in proposal_files:
        print("Reading proposal file:", proposal_path)
        with open(proposal_path, "r") as file:
            content = file.read()
            metadata = parse_yaml_metadata(content)
            sections = fetch_sections(content)

            print("====== Received Contents ======")

            title = metadata.get("Proposal Title", None)
            tagline = metadata.get("Tagline", None)
            requested_funding_amount = metadata.get("Requested Funding Amount", None)
            skills = metadata.get("Skills", None)
            organization_willing_to_sponsor = metadata.get(
                "Is your organization willing to sponsor this project?", None
            )
            existing_oss_project = metadata.get(
                "Is this an existing OSS project?", None
            )
            author = metadata.get("Author", None)
            description = sections["project_description"]
            details = sections["project_details"]
            project_stages = sections["project_stages"]
            extra_information = sections["supporting_info"]

            print("Title: ", title)
            print("Tagline: ", tagline)
            print("Requested Funding Amount: ", requested_funding_amount)
            print("Skills: ", skills)
            print("Organization Willing to Sponsor: ", organization_willing_to_sponsor)
            print("Existing OSS Project: ", existing_oss_project)
            print("Author: ", author)
            print("Project Description:", description)
            print("Project Details & Specifications:", details)
            print("Project Stages:", project_stages)
            print("Supporting Information:", extra_information)
            print("GitHub Repository URL:", repo_url)
            print("GitHub Default Branch:", default_branch)
            print("Latest Commit ID:", latest_commit_id)

            validate_proposal(
                title,
                tagline,
                requested_funding_amount,
                organization_willing_to_sponsor,
                existing_oss_project,
                author,
                description,
                details,
                project_stages,
                extra_information,
            )

            moderate_text(
                title, tagline, description, details, project_stages, extra_information
            )

            print("=========================================================")
            print("Validations & Moderations Checks Results:")
            print("=========================================================")
            print("{:<85} | {}".format("Check", "Result"))
            print("---------------------------------------------------------")

            for key, value in checklist.items():
                result = "Passed" if value else "Failed"
                print("{:<85} | {}".format(key, result))

            print("=========================================================")

            if all(checklist.values()):
                print("All checks passed. Submitting proposal to the API.")

                response = requests.post(
                    f"{API_URL}submit_proposal/",
                    data={
                        "title": title,
                        "tagline": tagline,
                        "funds_requested": requested_funding_amount,
                        "skills": skills,
                        "organization_willing_to_sponsor": (
                            True
                            if str(organization_willing_to_sponsor) == "Yes"
                            else False
                        ),
                        "existing_oss_project": (
                            True if str(existing_oss_project) == "Yes" else False
                        ),
                        "author": author,
                        "description": description,
                        "details": details,
                        "project_stages": project_stages,
                        "extra_information": extra_information,
                        "github_url": repo_url,
                        "commit_id": latest_commit_id,
                    },
                )

                if response.status_code == 200:
                    print(response.message)

            else:
                raise Exception(
                    "Some checks failed. Please fix the issues and try again."
                )

            print("=========================================================")


if __name__ == "__main__":
    main()
