import { BrowserRouter, Routes, Route } from "react-router-dom";
import Body from "./components/Body";
import Login from "./components/Login";
import Profile from "./components/Profile";
import Footer from "./components/Footer";
import Signup from "./components/Signup";
import { Provider } from "react-redux";
import appStore from "./utils/appStore";
import Feed from "./components/Feed";
import EditProfile from "./components/EditProfile";
import Connections from "./components/Connections";
import Requests from "./components/Requests";
import SentRequests from "./components/SentRequests";
import Premium from "./components/Premium";
import Chat from "./components/Chat";
import PremiumSuccess from "./components/PremiumSuccess";

function App() {
  return (
    <>
      <Provider store={appStore}>
        <BrowserRouter basename="/">
          <Routes>
            <Route path="/" element={<Body />}>
              <Route path="/" element={<Feed />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="connections" element={<Connections />} />
              <Route path="requests" element={<Requests />} />
              <Route path="premium" element={<Premium />} />
              <Route path="premium/success" element={<PremiumSuccess />} />
              <Route path="/chat/:targetUserId" element={<Chat />} />
              <Route path="requests/sent" element={<SentRequests />} />
              <Route path="/footer" element={<Footer />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Provider>
    </>
  );
}

export default App;
