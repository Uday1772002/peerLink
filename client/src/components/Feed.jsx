import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { BASE_URL } from "../utils/constants";
import { useDispatch, useSelector } from "react-redux";
import { addFeed } from "../utils/feedSlice";
import { experienceLevels, developerInterests } from "../utils/developerProfile";
import UserCard from "./userCard";

const Feed = () => {
  const feed = useSelector((store) => store.feed);
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterQuery = searchParams.toString();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const swipeInProgress = useRef(false);
  const requestRevision = useRef(0);

  const getFeed = useCallback(async (signal) => {
    const revision = ++requestRevision.current;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(BASE_URL + "/user/feed?" + filterQuery, {
        withCredentials: true,
        signal,
      });
      if (revision === requestRevision.current) dispatch(addFeed(res.data.data));
    } catch (err) {
      if (!axios.isCancel(err) && revision === requestRevision.current) {
        dispatch(addFeed([]));
        setError(err.response?.data?.message || "Unable to load profiles. Please try again.");
      }
    } finally {
      if (revision === requestRevision.current && !signal?.aborted) setLoading(false);
    }
  }, [filterQuery, dispatch]);

  useEffect(() => {
    const controller = new AbortController();
    getFeed(controller.signal);
    return () => controller.abort();
  }, [getFeed]);

  const applyFilters = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const field of ["skills", "location", "experienceLevel", "interest"]) {
      const value = form.get(field)?.trim();
      if (value) params.set(field, value);
    }
    if (params.toString() === filterQuery) getFeed();
    else setSearchParams(params);
  };

  const sendRequest = async (status) => {
    if (!feed?.length || loading || swipeInProgress.current) return;
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
      if (remainingFeed.length === 0) await getFeed();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send request. Please try again.");
    } finally {
      swipeInProgress.current = false;
      setSwiping(false);
    }
  };

  return (
    <div className="flex flex-col items-center mt-8 pb-28 gap-5 px-4">
      <form key={filterQuery} onSubmit={applyFilters} className="card bg-base-200 w-full max-w-4xl p-5 gap-3">
        <h1 className="text-xl font-semibold">Find your developer match</h1>
        <fieldset disabled={swiping} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="filter-skills" className="label text-sm">Any of these skills</label>
            <input id="filter-skills" name="skills" className="input input-bordered w-full" placeholder="React, Node.js" defaultValue={searchParams.get("skills") || ""} />
          </div>
          <div>
            <label htmlFor="filter-location" className="label text-sm">Location</label>
            <input id="filter-location" name="location" className="input input-bordered w-full" maxLength={100} placeholder="City or region" defaultValue={searchParams.get("location") || ""} />
          </div>
          <div>
            <label htmlFor="filter-experience" className="label text-sm">Experience</label>
            <select id="filter-experience" name="experienceLevel" className="select select-bordered w-full" defaultValue={searchParams.get("experienceLevel") || ""}>
              <option value="">Any experience</option>
              {experienceLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-interest" className="label text-sm">Their goal</label>
            <select id="filter-interest" name="interest" className="select select-bordered w-full" defaultValue={searchParams.get("interest") || ""}>
              <option value="">Any interest</option>
              {developerInterests.map((interest) => <option key={interest.value} value={interest.value}>{interest.label}</option>)}
            </select>
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" disabled={swiping}>Apply filters</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={swiping} onClick={() => filterQuery ? setSearchParams({}) : getFeed()}>Clear filters</button>
        </div>
      </form>
      {error && (
        <div className="alert alert-error max-w-lg" role="alert">
          <span>{error}</span><Link to="/premium" className="link">View premium</Link>
        </div>
      )}
      {loading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : feed?.length > 0 ? (
        <>
          <div className="relative" style={{ width: "380px", height: "580px" }}>
            {feed.slice(0, 3).reverse().map((user, i, arr) => {
              const isTop = i === arr.length - 1;
              const stackIndex = arr.length - 1 - i;
              return (
                <div key={user._id} className="absolute top-0 left-0" style={{
                  width: "380px", height: "580px",
                  transform: `scale(${1 - stackIndex * 0.04}) translateY(${stackIndex * 10}px)`,
                  transformOrigin: "bottom center", zIndex: isTop ? 10 : i,
                  pointerEvents: isTop ? "auto" : "none",
                }}>
                  <UserCard user={user} disabled={swiping} onSwipeLeft={isTop ? () => sendRequest("ignored") : undefined} onSwipeRight={isTop ? () => sendRequest("interested") : undefined} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-6">
            <button disabled={swiping} onClick={() => sendRequest("ignored")} className="btn btn-circle btn-lg btn-outline btn-error" aria-label="Pass">✕</button>
            <button disabled={swiping} onClick={() => sendRequest("interested")} className="btn btn-circle btn-lg btn-outline btn-success" aria-label="Interested">♥</button>
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <p className="text-xl text-base-content/60">{filterQuery ? "No profiles match these filters." : "No more profiles!"}</p>
          {filterQuery && <p className="text-sm text-base-content/50 mt-2">Try fewer filters or clear them to explore more developers.</p>}
        </div>
      )}
    </div>
  );
};

export default Feed;
