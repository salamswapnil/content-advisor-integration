import { loadScript } from '../../scripts/aem.js';

const ASSET_SELECTORS_SCRIPT = 'https://experience.adobe.com/solutions/CQ-assets-selectors/static-assets/resources/assets-selectors.js';

export default async function decorate(block) {
  await loadScript(ASSET_SELECTORS_SCRIPT);

  const dialog = document.createElement('dialog');
  dialog.className = 'content-advisor-dialog';
  const container = document.createElement('div');
  container.id = 'content-advisor';
  dialog.append(container);

  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.textContent = 'Launch Content Advisor';
  block.append(launchButton, dialog);

  let imsInstance = null;
  const imsProps = {
    imsClientId: "aem-assets-frontend-1",
    imsScope: "AdobeID,openid,additional_info.projectedProductContext,read_organizations",
    redirectUrl: "https://experience.adobe.com/solutions/CQ-assets-selectors/static-assets/resources/integration/index.html",
    modalMode: true,
    // Optional parameters:
    // modalMode: false, // set to false to open in a full page reload flow
    // adobeImsOptions: {
    //     modalSettings: {
    //         allowOrigin: window.location.origin,
    //     },
    //     useLocalStorage: true,
    // },
    // onImsServiceInitialized: (service) => {
    //     console.log("onImsServiceInitialized", service);
    // },
    // onAccessTokenReceived: (token) => {
    //     console.log("onAccessTokenReceived", token);
    // },
    // onAccessTokenExpired: () => {
    //     console.log("onAccessTokenError");
    //     // re-trigger sign-in flow
    // },
    // onErrorReceived: (type, msg) => {
    //     console.log("onErrorReceived", type, msg);
    // },
  };

  // Must be called on page load before rendering ContentAdvisor.
  // If your redirectUrl differs from the imsClientId registration, also call this on the redirect page.
  function registerImsAuthService() {
    const registeredTokenService = PureJSSelectors.registerContentAdvisorAuthService(imsProps);
    // registeredTokenService exposes: getAccessToken(), signIn(), signOut(), refreshToken()
    imsInstance = registeredTokenService;
  };

  // Must be register token service before the selectors are rendered.
  registerImsAuthService();

  function onClose() {
    dialog.close();
  }

  function destinationSelectorOnClose() {
    document.getElementById('destination-selector-dialog').close();
  }

  function handleSelection(selection) {
    console.log('Selected asset:', selection);
    onClose();
  }

  function handleOnConfirm(selection) {
    console.log('Selected path:', selection);
    destinationSelectorOnClose();
  }

  async function renderContentAdvisorWithImsFlow() {
    PureJSSelectors.renderContentAdvisorWithAuthFlow(container, {
      onClose: onClose,
      handleSelection: handleSelection,
      imsOrg: "aem-assets-frontend-1",
      aemTierType: ['delivery', 'author'],
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    }, () => {
      dialog.showModal();
    });
  }

  launchButton.addEventListener('click', renderContentAdvisorWithImsFlow);

  async function renderDestinationSelectorWithImsFlow() {
    const container = document.getElementById('destination-selector');
    PureJSSelectors.renderDestinationSelectorWithAuthFlow(container, {
      onClose: destinationSelectorOnClose,
      onConfirm: handleOnConfirm,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    }, () => {
      document.getElementById('destination-selector-dialog').showModal();
    });
  }

  async function logoutImsFlow() {
    await imsInstance.signOut();
  }


}