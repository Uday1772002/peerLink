import MembershipBadge from "./MembershipBadge";
import React, { useState, useRef } from "react";

const UserCard = ({ user, onSwipeLeft, onSwipeRight, disabled }) => {

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  if (!user) return null;
  const { firstName, lastName, photoUrl, age, gender, about } = user;

  const handlePointerDown = (e) => {
    if (disabled || (!onSwipeLeft && !onSwipeRight)) return;
    setDragging(true);
    startX.current = e.clientX;
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    setOffset(e.clientX - startX.current);
  };

  const handlePointerUp = () => {
    setDragging(false);
    if (offset > 100) {
      onSwipeRight && onSwipeRight();
    } else if (offset < -100) {
      onSwipeLeft && onSwipeLeft();
    }
    setOffset(0);
  };

  const rotation = offset / 20;
  const opacity = Math.max(0, 1 - Math.abs(offset) / 300);

  return (
    <div
      className="relative rounded-3xl overflow-hidden shadow-2xl cursor-grab select-none bg-base-100"
      style={{
        width: "380px",
        height: "580px",
        transform: `translateX(${offset}px) rotate(${rotation}deg)`,
        transition: dragging ? "none" : "transform 0.3s ease",
        opacity,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="absolute top-4 right-4 z-10"><MembershipBadge user={user} /></div>
      {/* Photo fills entire card */}
      <img
        src={photoUrl || "https://api.dicebear.com/9.x/thumbs/svg?seed=" + user._id}
        alt={firstName}
        className="w-full h-full object-cover pointer-events-none"
      />

      {/* LIKE / NOPE stamps */}
      {offset > 40 && (
        <div className="absolute top-8 left-8 border-4 border-green-400 text-green-400 font-black text-3xl px-4 py-1 rounded-xl rotate-[-20deg] z-10 bg-black/20">
          LIKE
        </div>
      )}
      {offset < -40 && (
        <div className="absolute top-8 right-8 border-4 border-red-400 text-red-400 font-black text-3xl px-4 py-1 rounded-xl rotate-20 z-10 bg-black/20">
          NOPE
        </div>
      )}

      {/* Info overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-6 py-6 text-white">
        <h2 className="text-2xl font-bold">
          {firstName} {lastName}{age && <span className="font-light">, {age}</span>}
        </h2>
        {gender && <p className="text-sm text-gray-300 mt-1">{gender}</p>}
        {about && <p className="text-sm mt-2 text-gray-200 line-clamp-2">{about}</p>}
      </div>
    </div>
  );
};

export default UserCard;
