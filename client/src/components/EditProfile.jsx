import React, { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { addUser } from "../utils/userSlice";
import axios from "axios";
import { BASE_URL } from "../utils/constants";

const EditProfileForm = ({ user }) => {
  const dispatch = useDispatch();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [photoSource, setPhotoSource] = useState(
    user.photoUrl ? "url" : "device",
  );
  const [selectedImageName, setSelectedImageName] = useState("");
  const [age, setAge] = useState(user.age);
  const [gender, setGender] = useState(user.gender || "");
  const [about, setAbout] = useState(user.about);
  const [skills, setSkills] = useState(
    user.skills ? user.skills.join(", ") : "",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoSource("device");
      setSelectedImageName(file.name);
      setPhotoUrl(reader.result);
      setError("");
    };
    reader.onerror = () => {
      setError("Unable to read the selected photo. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    try {
      const res = await axios.patch(
        BASE_URL + "/profile/edit",
        {
          firstName,
          lastName,
          photoUrl,
          age: age ? Number(age) : undefined,
          gender,
          about,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        { withCredentials: true },
      );
      dispatch(addUser(res.data.data));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data || "Failed to update profile");
      setTimeout(() => setError(""), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center py-12 px-4">
      {success && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="alert alert-success shadow-lg px-8">
            <span>✓ Profile updated successfully!</span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-stretch justify-center w-full max-w-5xl">
        {/* ── Edit Form ── */}
        <div className="card bg-base-300 shadow-2xl flex-1">
          <div className="card-body gap-3">
            <h2 className="text-xl font-bold tracking-wide border-b border-base-content/10 pb-3 mb-1">
              Edit Profile
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    First Name
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered input-sm h-10 w-full"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    Last Name
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered input-sm h-10 w-full"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                  Photo
                </span>
              </label>

              <div className="flex gap-3 w-full mb-2">
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${
                    photoSource === "url" ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setPhotoSource("url")}
                >
                  Use URL
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${
                    photoSource === "device" ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setPhotoSource("device")}
                >
                  Add from device
                </button>
              </div>

              {photoSource === "url" ? (
                <input
                  type="text"
                  className="input input-bordered input-sm h-10 w-full"
                  value={photoUrl}
                  placeholder="https://example.com/photo.jpg"
                  onChange={(e) => {
                    setPhotoUrl(e.target.value);
                    setSelectedImageName("");
                  }}
                />
              ) : (
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm h-10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose image
                  </button>
                  <span className="text-sm text-base-content/70 truncate">
                    {selectedImageName || "No image selected"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    Age
                  </span>
                </label>
                <input
                  type="number"
                  className="input input-bordered input-sm h-10 w-full"
                  value={age}
                  min={18}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    Gender
                  </span>
                </label>
                <select
                  className="select select-bordered select-sm h-10 w-full"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                  About
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered resize-none text-sm"
                rows={3}
                value={about}
                placeholder="Tell others about yourself..."
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label pb-1">
                <span className="label-text text-xs font-semibold uppercase tracking-wider text-base-content/60">
                  Skills{" "}
                  <span className="normal-case font-normal">
                    (comma separated)
                  </span>
                </span>
              </label>
              <input
                type="text"
                className="input input-bordered input-sm h-10 w-full"
                value={skills}
                placeholder="React, Node.js, MongoDB"
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>

            {error && (
              <div className="alert alert-error text-sm py-2 mt-1">
                <span>{error}</span>
              </div>
            )}

            <button
              className="btn btn-primary w-full mt-2 font-semibold tracking-wide"
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* ── Live Preview Card ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40">
              Live Preview
            </p>
          </div>
          <div
            className="relative rounded-3xl overflow-hidden shadow-2xl bg-base-100"
            style={{ width: "380px", height: "580px" }}
          >
            {/* Photo fills entire card */}
            <img
              src={
                photoUrl ||
                "https://api.dicebear.com/9.x/thumbs/svg?seed=preview"
              }
              alt="preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src =
                  "https://api.dicebear.com/9.x/thumbs/svg?seed=preview";
              }}
            />

            {/* Info overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent px-6 py-6 text-white">
              <h2 className="text-2xl font-bold">
                {firstName || "First"} {lastName || "Last"}
                {age && <span className="font-light">, {age}</span>}
              </h2>
              {gender && (
                <p className="text-sm text-gray-300 mt-1">
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </p>
              )}
              {about && (
                <p className="text-sm mt-2 text-gray-200 line-clamp-2">
                  {about}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons below card */}
          <div className="flex gap-6">
            <button className="btn btn-circle btn-lg btn-outline btn-error text-xl shadow-lg">
              ✕
            </button>
            <button className="btn btn-circle btn-lg btn-outline btn-success text-xl shadow-lg">
              ♥
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditProfile = () => {
  const user = useSelector((store) => store.user);
  if (!user) return null;
  return <EditProfileForm user={user} />;
};

export default EditProfile;
