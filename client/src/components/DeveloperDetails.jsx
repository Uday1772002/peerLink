import React from "react";
import { developerInterests, experienceLevels } from "../utils/developerProfile";

const isSafeLink = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const DeveloperDetails = ({ user, compact = false }) => {
  const level = experienceLevels.find((level) => level.value === user.experienceLevel)?.label;

  return (
    <div className="flex flex-col gap-2 mt-2 text-sm">
      {(user.location || level) && (
        <p className="opacity-80">{[user.location, level].filter(Boolean).join(" · ")}</p>
      )}
      {user.interests?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {user.interests.map((interest) => (
            <span key={interest} className="badge badge-outline badge-xs">
              {developerInterests.find((item) => item.value === interest)?.label || interest}
            </span>
          ))}
        </div>
      )}
      {isSafeLink(user.githubUrl) && (
        <a href={user.githubUrl} target="_blank" rel="noopener noreferrer" className="link font-medium">
          GitHub profile ↗
        </a>
      )}
      {user.projects?.length > 0 && (
        <div className="flex flex-col gap-2">
          {user.projects.slice(0, compact ? 1 : 3).map((project, index) => (
            <div key={project._id || index}>
              {isSafeLink(project.url) ? (
                <a href={project.url} target="_blank" rel="noopener noreferrer" className="link font-medium break-words">
                  {project.title || "Project"} ↗
                </a>
              ) : <span>{project.title || "Project"}</span>}
              {!compact && project.description && <p className="text-xs opacity-70 break-words mt-1">{project.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeveloperDetails;
