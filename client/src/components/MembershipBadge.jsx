import React from "react";

const MembershipBadge = ({ user }) => {
  if (
    !user?.isPremium ||
    !user.membershipValidUntil ||
    new Date(user.membershipValidUntil) <= new Date()
  ) {
    return null;
  }
  const type = user.membershipType === "premium" ? "platinum" : user.membershipType;
  const badgeColor = type === "gold" ? "badge-warning" : type === "platinum" ? "badge-info" : "badge-neutral";

  return (
    <span className={"badge badge-sm capitalize " + badgeColor}>
      {type} member
    </span>
  );
};

export default MembershipBadge;
