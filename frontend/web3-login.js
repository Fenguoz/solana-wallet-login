let userLoginData = {
    state: "loggedOut",
    ethAddress: "",
    buttonText: "Log in",
    publicName: "",
    JWT: "",
    config: { headers: { "Content-Type": "application/json" } }
  }
  
  
  if (typeof(backendPath) == 'undefined') {
    var backendPath = '';
  }
  
  
  // On accountsChanged
  async function ethAccountsChanged() {      
    let accountsOnEnable = await web3.eth.getAccounts();
    let address = accountsOnEnable[0];
    address = address.toLowerCase();
    if (userLoginData.ethAddress != address) {
      userLogOut();
      getPublicName();
    }
    if (userLoginData.ethAddress != null && userLoginData.state == "needLogInToMetaMask") {
      userLoginData.state = "loggedOut";
    }
  }
  
  function userLogOut() {
    userLoginData.state = "loggedOut";
    userLoginData.ethAddress = "";
    userLoginData.buttonText = "Log in";
    showButtonText();
    userLoginData.publicName = "";
    userLoginData.JWT = "";
    document.getElementById('loggedIn').style.display = 'none';
    document.getElementById('loggedOut').style.display = 'block';
  }
  
  
  // Show current msg
  function showMsg(id) {
    let x = document.getElementsByClassName("user-login-msg");
    let i;
    for (i = 0; i < x.length; i++) {
        x[i].style.display = 'none';
    }
    document.getElementById(id).style.display = 'block';
  }
  
  
  // Show current address
  function showAddress() {
    document.getElementById('ethAddress').innerHTML = userLoginData.ethAddress;
  }
  
  
  // Show current button text
  function showButtonText() {
    document.getElementById('buttonText').innerHTML = userLoginData.buttonText;
  }
  
  const getProvider = () => {
    if ('phantom' in window) {
      const provider = window.phantom?.solana;
  
      if (provider?.isPhantom) {
        return provider;
      }
    }
    
    userLoginData.state = "needMetamask";
    showMsg(userLoginData.state);
    return;
    // window.open('https://phantom.app/', '_blank');
  };

  async function userLoginOut() {
    const provider = getProvider(); // see "Detecting the Provider"
    try {
        const resp = await provider.connect();
        userLogin(resp.publicKey.toString());
        console.log(resp.publicKey.toString());
        // 26qv4GCcx98RihuK3c4T6ozB3J7L6VwCuFVc7Ta2A3Uo 
    } catch (error) {
        // { code: 4001, message: 'User rejected the request.' }
        console.log(error);
        userLoginData.state = 'needLogInToMetaMask';
        showMsg(userLoginData.state);
        return;
    }
  }
  
  async function userLogin(address) {
    if (userLoginData.state == "loggedIn") {
      userLoginData.state = "loggedOut";
      showMsg(userLoginData.state);
      userLoginData.JWT = "";
      userLoginData.buttonText = "Log in";
      showButtonText();
      return;
    }
    if (typeof window.web3 === "undefined") {
      userLoginData.state = "needMetamask";
      showMsg(userLoginData.state);
      return;
    }
    // address = address.toLowerCase();
    if (address == null) {
      userLoginData.state = "needLogInToMetaMask";
      showMsg(userLoginData.state);
      return;
    }
    userLoginData.state = "signTheMessage";
    showMsg(userLoginData.state);
  
    axios.post(
      backendPath+"backend/server.php",
      {
        request: "login",
        address: address
      },
      userLoginData.config
    )
    .then(function(response) {
      if (response.data.substring(0, 5) != "Error") {
        let message = response.data;
        let publicAddress = address;
        handleSignMessage(message, publicAddress).then(handleAuthenticate);
  
        async function handleSignMessage(message, publicAddress) {
            const provider = getProvider(); // see "Detecting the Provider"
            const encodedMessage = new TextEncoder().encode(message);
            const signature = await provider.signMessage(encodedMessage, "hex");
            return { publicAddress, signature: base58encode(signature.signature)};
        }
  
        function handleAuthenticate({ publicAddress, signature }) {
          axios
            .post(
              backendPath+"backend/server.php",
              {
                request: "auth",
                address: arguments[0].publicAddress,
                signature: arguments[0].signature
              },
              userLoginData.config
            )
            .then(function(response) {
              if (response.data[0] == "Success") {
                userLoginData.state = "loggedIn";
                showMsg(userLoginData.state);
                userLoginData.buttonText = "Log out";
                showButtonText();
                userLoginData.ethAddress = address;
                showAddress();
                userLoginData.publicName = response.data[1];
                getPublicName();
                userLoginData.JWT = response.data[2];
                // Clear Web3 wallets data for logout
                localStorage.clear();
              }
            })
            .catch(function(error) {
              console.error(error);
            });
        }
      } 
      else {
        console.log("Error: " + response.data);
      }
    })
    .catch(function(error) {
      console.error(error);
    });
  } 
  
  
  function getPublicName() {
    document.getElementById('updatePublicName').value = userLoginData.publicName;
  }
  
  
  function setPublicName() {
    let value = document.getElementById('updatePublicName').value;
    axios.post(
      backendPath+"backend/server.php",
      {
        request: "updatePublicName",
        address: userLoginData.ethAddress,
        JWT: userLoginData.JWT,
        publicName: value
      },
      this.config
    )
    .then(function(response) {
      console.log(response.data);
    })
    .catch(function(error) {
      console.error(error);
    });
  }