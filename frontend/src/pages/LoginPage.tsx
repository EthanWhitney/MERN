import './LoginPage.css';
import PageTitle from '../components/PageTitle.tsx';
import Login from '../components/Login.tsx';

const LoginPage = () =>
{

    return(
      <div className="login-page">
        <div className="login-brand" aria-label="Syncord">
          <img
            className="login-logo"
            src="/syncord-logo.png"
            alt="Syncord logo"
          />
          <PageTitle />
        </div>
        <div className="login-panel" aria-label="Login">
          <Login />
        </div>
      </div>
    );
};

export default LoginPage;
