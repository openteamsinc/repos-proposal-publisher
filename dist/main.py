import os
import re
from uuid import uuid4

import requests
import yaml

API_URL = os.getenv("API_URL")
GH_TOKEN = os.getenv("GH_TOKEN")
GITHUB_REPOSITORY = os.getenv("GITHUB_REPOSITORY")
GITHUB_REF = os.getenv("GITHUB_REF")
GITHUB_SHA = os.getenv("GITHUB_SHA")

if not API_URL:
    raise ValueError("API_URL environment variable is not set.")

if not GH_TOKEN:
    raise ValueError("GH_TOKEN environment variable is not set.")

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

proposal_list = dict()
github_repository_url = (
    f"https://github.com/{GITHUB_REPOSITORY}" if GITHUB_REPOSITORY else None
)
github_default_branch = GITHUB_REF.split("/")[-1] if GITHUB_REF else None
latest_commit_id = GITHUB_SHA if GITHUB_SHA else None
bypass_process = GITHUB_REPOSITORY != "openteamsinc/repos-proposal-publisher"


def check_title(title: str) -> bool:
    response = requests.get(f"{API_URL}check_title?title={title}")
    return response.status_code == 200


def check_username(username: str) -> bool:
    response = requests.get(f"{API_URL}check_username?username={username.lstrip('@')}")
    return response.status_code == 200


def check_proposal_on_repos(pid: uuid4) -> dict:
    response = requests.get(f"{API_URL}check_proposal?pid={pid}")
    if response.status_code == 200:
        return response.json()["proposal"][0]
    return None


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
    old_proposal_data: dict,
    pid: uuid4,
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

    print("Performing validations on the proposal.....")

    print("Validating Title.....")
    if title:
        print("Title is present.")
        if pid and old_proposal_data and old_proposal_data["title"] == title:
            checklist["Title must be unique."] = True
        else:
            checklist["Title must be unique."] = check_title(title)
            if len(title.split(" ")) > 20:
                checklist["Title must be less than 20 words."] = False
    else:
        print("Title is not present.")
        checklist["Title is required."] = False
        checklist["Title must be unique."] = False
        checklist["Title must be less than 20 words."] = False
        checklist["Title moderation passed."] = False

    if tagline:
        print("Validating Tagline.....")
        print("Tagline is present.")
        if len(tagline) > 160:
            checklist["Tagline must be less than 160 characters."] = False
    else:
        print("Tagline is not present.")
        del checklist["Tagline must be less than 160 characters."]
        del checklist["Tagline moderation passed."]

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

    print("Validating Author.....")
    if author:
        checklist["Author must be a user on REPOS."] = check_username(author)
    else:
        checklist["Author is required."] = False
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

    else:
        if len(project_stages["Phase 1"].split(" ")) < 20:
            checklist["Phase 1 must be more than 20 words."] = False

        if len(project_stages["Phase 2"].split(" ")) < 20:
            checklist["Phase 2 must be more than 20 words."] = False

    # Validate additional phases if present
    for phase, phase_description in project_stages.items():
        if phase not in ["Phase 1", "Phase 2"]:
            if len(phase_description.split(" ")) < 20:
                checklist[f"{phase} must be more than 20 words."] = False
            else:
                checklist[f"{phase} must be more than 20 words."] = True

    if not extra_information:
        del checklist["Supporting information moderation passed."]


def moderation_api_request(text: str) -> bool:
    response = requests.post(f"{API_URL}check_moderation/", data={"text": text})
    return True if response.status_code == 200 else False


def moderate_text(
    old_proposal_data: dict,
    pid: uuid4,
    title: str,
    tagline: str,
    description: str,
    details: str,
    project_stages: dict,
    extra_information: str,
) -> None:
    if pid and old_proposal_data and old_proposal_data["title"] != title:
        checklist["Title moderation passed."] = moderation_api_request(title)
    else:
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
        else:
            checklist[f"{phase_key} moderation passed."] = True
    if not moderation_api_request(extra_information):
        checklist["Supporting information moderation passed."] = False


def main():
    # Read the proposal file
    print("=" * 100)
    print("Reading proposals from the folder.....")
    proposal_files = read_proposal_folder()
    print("Found proposals in the folder: ")
    print("\n".join(proposal_files))

    for proposal_path in proposal_files:

        pid = None
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
        old_proposal_data = None

        print("Reading proposal file: ", proposal_path.split("/")[-1])

        with open(proposal_path, "r") as file:

            content = file.read()
            metadata = parse_yaml_metadata(content)
            sections = fetch_sections(content)

            print("================== Received Contents ==================")

            pid = metadata.get("Proposal ID", None)
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
            print("GitHub Repository URL:", github_repository_url)
            print("GitHub Default Branch:", github_default_branch)
            print("Latest Commit ID:", latest_commit_id)

            if pid:
                print("Proposal ID: ", pid)
                old_proposal_data = check_proposal_on_repos(pid)

            validate_proposal(
                old_proposal_data,
                pid,
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
                old_proposal_data,
                pid,
                title,
                tagline,
                description,
                details,
                project_stages,
                extra_information,
            )

            print("=" * 100)
            print("Validations & Moderations Checks Results:")
            print("=" * 100)
            print("{:<85} | {}".format("Check", "Result"))
            print("-" * 100)

            for key, value in checklist.items():
                result = "Passed" if value else "Failed"
                print("{:<85} | {}".format(key, result))

            print("=" * 100)

            payload = {
                "title": title,
                "tagline": tagline,
                "funds_requested": requested_funding_amount,
                "skills": skills,
                "organization_willing_to_sponsor": (
                    True if str(organization_willing_to_sponsor) == "Yes" else False
                ),
                "existing_oss_project": (
                    True if str(existing_oss_project) == "Yes" else False
                ),
                "author": str(author).split("@")[-1],
                "description": description,
                "details": details,
                "project_stages": project_stages,
                "extra_information": extra_information,
                "github_url": github_repository_url,
                "commit_id": latest_commit_id,
            }

            proposal_list[proposal_path.split("/")[-1]] = {
                "payload": payload,
                "checklist": checklist,
                "path": proposal_path,
            }

    for filename, proposal_data in proposal_list.items():
        if not all(proposal_data["checklist"].values()):
            print(f"Skipping proposal for {filename} due to failed checks.")
            continue

        print(f"Submitting proposal for {filename}")
        if bypass_process:
            response = requests.post(
                f"{API_URL}submit_proposal/",
                json=proposal_data["payload"],
            )
            if response.status_code == 200:
                print(response.json()["message"])

                if "proposal_id" in response.json():
                    with open(proposal_data["path"], "r+") as file:
                        lines = file.readlines()
                        proposal_id_line = (
                            f'Proposal ID: "{response.json()["proposal_id"]}"\n'
                        )
                        lines.insert(1, proposal_id_line)
                        file.seek(0)
                        file.writelines(lines)
        else:
            print(f"Failed to submit proposal for {filename}")

    print("=" * 100)
    print("Completed processing proposals.")


if __name__ == "__main__":
    main()
