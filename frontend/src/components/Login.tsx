import { useState } from "react";
import { buildPath } from "../utils/config";
import { storeTokens } from "../utils/tokenStorage";

function Login()
{
  const [message, setMessage] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setPassword] = useState('');

  function handleSetLoginName(e: any) : void
  {
    setLoginName(e.target.value);
  }

  function handleSetPassword(e: any) : void
  {
    setPassword(e.target.value);
  }

   async function doLogin(event:any) : Promise<void>
  {
      event.preventDefault();

      var obj = {emailOrUsername:loginName,password:loginPassword};
      var js = JSON.stringify(obj);

      try
      {    
          const response = await fetch(buildPath('api/auth/login'),
              {method:'POST',body:js,headers:{'Content-Type': 'application/json'}});

          var res = JSON.parse(await response.text());

          if( res.error && res.error.length > 0 )
          {
              setMessage(res.error);
          }
          else if( !res.accessToken || res.accessToken.length === 0 || !res.refreshToken || res.refreshToken.length === 0 )
          {
              setMessage('Login failed: Missing token data');
          }
          else
          {
              // Store auth tokens
              storeTokens(res.accessToken, res.refreshToken);
              
              // Store user data
              var user = {username:res.username,id:res.userId}
              localStorage.setItem('user_data', JSON.stringify(user));

              setMessage('');
              window.location.href = '/friends';
          }
      }
      catch(error:any)
      {
          alert(error.toString());
          return;
      }    
    };

  return(
    <div id="loginDiv">
      <span id="inner-title">PLEASE LOG IN</span><br />

      <input
        type="text"
        id="loginName"
        placeholder="Email or Username"
        onChange={handleSetLoginName}
      /><br />

      <input
        type="password"
        id="loginPassword"
        placeholder="Password"
        onChange={handleSetPassword}
      /><br />

      <input
        type="submit"
        id="loginButton"
        className="buttons"
        value="Do It"
        onClick={doLogin}
      />

      <span id="loginResult">{message}</span><br />

      <a href="/register">Don't have an account? Register here</a>
    </div>
  );
}

export default Login;
