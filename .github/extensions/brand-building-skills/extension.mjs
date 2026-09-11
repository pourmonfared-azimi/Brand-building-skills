// Extension: brand-building-skills
// Expose the repository's canonical brand skills to Copilot without duplicating their markdown content.

import { joinSession } from "@github/copilot-sdk/extension";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const skillsRoot = path.resolve(process.cwd(), "skills");

function skillPath(name) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error("Skill names must contain only lowercase letters, numbers, and hyphens.");
    }

    return path.join(skillsRoot, name, "SKILL.md");
}

function frontmatterValue(content, field) {
    const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "No description provided.";
}

async function listSkills() {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const file = await readFile(skillPath(entry.name), "utf8");
        skills.push({
            name: entry.name,
            description: frontmatterValue(file, "description"),
        });
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
}

await joinSession({
    tools: [
        {
            name: "brand_skill",
            description:
                "List the repository's brand skills or read one canonical SKILL.md when a brand workflow is needed. Start with brand-context for new projects.",
            parameters: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["list", "read"],
                        description: "Whether to list available skills or read one skill.",
                    },
                    skill: {
                        type: "string",
                        description: "Skill directory name, required when action is read.",
                    },
                },
                required: ["action"],
            },
            handler: async ({ action, skill }) => {
                if (action === "list") {
                    return JSON.stringify(await listSkills(), null, 2);
                }

                if (action !== "read") {
                    throw new Error(`Unsupported action: ${action}`);
                }

                if (!skill) {
                    throw new Error("The skill argument is required when action is read.");
                }

                return await readFile(skillPath(skill), "utf8");
            },
        },
    ],
});
