import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { joinSession } from "@github/copilot-sdk/extension";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
const projectSkillsRoot = path.resolve(process.cwd(), "skills");
const bundledSkillsRoot = path.join(extensionRoot, "skills");

function validateSkillName(name) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error("Skill names must contain only lowercase letters, numbers, and hyphens.");
    }
}

async function resolveSkillsRoot() {
    try {
        await access(projectSkillsRoot);
        return projectSkillsRoot;
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        return bundledSkillsRoot;
    }
}

async function readSkill(name) {
    validateSkillName(name);
    const root = await resolveSkillsRoot();
    return readFile(path.join(root, name, "SKILL.md"), "utf8");
}

await joinSession({
    tools: [
        {
            name: "brand_skill",
            description:
                "List the repository's brand skills or read one canonical SKILL.md for a brand workflow. Start with brand-context for new projects.",
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
                const root = await resolveSkillsRoot();

                if (action === "list") {
                    const entries = await readdir(root, { withFileTypes: true });
                    const skills = [];
                    for (const entry of entries) {
                        if (!entry.isDirectory()) continue;
                        const content = await readFile(path.join(root, entry.name, "SKILL.md"), "utf8");
                        const match = content.match(/^description:\s*(.+)$/m);
                        skills.push({
                            name: entry.name,
                            description: match ? match[1].trim() : "No description provided.",
                        });
                    }
                    return JSON.stringify(skills.sort((a, b) => a.name.localeCompare(b.name)), null, 2);
                }

                if (action !== "read") {
                    throw new Error(`Unsupported action: ${action}`);
                }
                if (!skill) {
                    throw new Error("The skill argument is required when action is read.");
                }
                return readSkill(skill);
            },
        },
    ],
});
