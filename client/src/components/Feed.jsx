import React, { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { BASE_URL } from "../utils/constants";
import { useDispatch } from "react-redux";
import { addFeed } from "../utils/feedSlice";
import { useSelector } from "react-redux";
import { useEffect } from "react";
import UserCard from "./userCard";

const Feed = () => {
  const feed = useSelector((store) => store.feed);
  const dispatch = useDispatch();
  const [error, setError] = useState("");
  const [swiping, setSwiping] = useState(false);
  const swipeInProgress = useRef(false);

  const getFeed = useCallback(async (refresh = false) => {
    try {
      if (feed && !refresh) return;
      const res = await axios.get(BASE_URL + "/user/feed", {
        withCredentials: true,
      });
      dispatch(addFeed(res.data.data));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load profiles. Please try again.");
    }
  }, [feed, dispatch]);

  useEffect(() => {
    getFeed();
  }, [getFeed]);

  const sendRequest = async (status) => {
    if (!feed?.length || swipeInProgress.current) return;
    swipeInProgress.current = true;
    setSwiping(true);
    setError("");
    try {
      await axios.post(
        `${BASE_URL}/request/send/${status}/${feed[0]._id}`,
        {},
        { withCredentials: true },
      );
      const remainingFeed = feed.slice(1);
      dispatch(addFeed(remainingFeed));
      if (remainingFeed.length === 0) await getFeed(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send request. Please try again.");
    } finally {
      swipeInProgress.current = false;
      setSwiping(false);
    }
  };

  const handleSwipeLeft = () => sendRequest("ignored");
  const handleSwipeRight = () => sendRequest("interested");

  return feed && feed.length > 0 ? (
    <div className="flex flex-col items-center mt-10 pb-28 gap-4">
      {error && <div className="alert alert-error max-w-lg" role="alert"><span>{error}</span><Link to="/premium" className="link">View premium</Link></div>}
      <div className="relative" style={{ width: "380px", height: "580px" }}>
        {feed
          .slice(0, 3)
          .reverse()
          .map((user, i, arr) => {
            const isTop = i === arr.length - 1;
            const stackIndex = arr.length - 1 - i; // 0 = top card
            const scale = 1 - stackIndex * 0.04;
            const translateY = stackIndex * 10;
            return (
              <div
                key={user._id}
                className="absolute top-0 left-0"
                style={{
                  width: "380px",
                  height: "580px",
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  transformOrigin: "bottom center",
                  zIndex: isTop ? 10 : i,
                  pointerEvents: isTop ? "auto" : "none",
                }}
              >
                <UserCard
                  user={user}
                  disabled={swiping}
                  onSwipeLeft={isTop ? handleSwipeLeft : undefined}
                  onSwipeRight={isTop ? handleSwipeRight : undefined}
                />
              </div>
            );
          })}
      </div>
      <div className="flex gap-6">
        <button disabled={swiping} onClick={handleSwipeLeft} className="btn btn-circle btn-lg btn-outline btn-error" aria-label="Pass">✕</button>
        <button disabled={swiping} onClick={handleSwipeRight} className="btn btn-circle btn-lg btn-outline btn-success" aria-label="Interested">♥</button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-center mt-20 gap-4">
      {error && <p className="text-error" role="alert">{error}</p>}
      <p className="text-xl text-gray-500">No more profiles!</p>
    </div>
  );
};

export default Feed;
