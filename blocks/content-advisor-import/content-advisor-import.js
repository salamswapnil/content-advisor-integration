import { loadScript } from '../../scripts/aem.js';

const ASSET_SELECTORS_SCRIPT = 'https://experience.adobe.com/solutions/CQ-assets-selectors/static-assets/resources/assets-selectors.js';
const RENDITION_RELATION = 'http://ns.adobe.com/adobecloud/rel/rendition';

function getSelectedAsset(selection) {
  return Array.isArray(selection) ? selection[0] : selection;
}

function getAssetUrl(asset, mediaType) {
  const repositoryId = asset['repo:repositoryId'];
  const assetId = asset['repo:assetId'];
  if (!repositoryId || !assetId) return null;

  const deliveryRepository = repositoryId.replace('author', 'delivery');
  const assetUrl = `https://${deliveryRepository}/adobe/assets/${assetId}`;
  const name = (asset.name || 'asset').trim().replace(/\s+/g, '-');

  if (mediaType === 'image') return `${assetUrl}/as/${encodeURIComponent(name)}?preferwebp=true`;
  if (mediaType === 'video') return `${assetUrl}/play`;
  return `${assetUrl}/original/as/${encodeURIComponent(name)}`;
}

function getLargestRendition(asset) {
  const renditions = asset?.['_links']?.[RENDITION_RELATION];
  if (!Array.isArray(renditions) || renditions.length === 0) return null;
  return renditions.reduce((largest, rendition) => (
    rendition.width * rendition.height > largest.width * largest.height
      ? rendition
      : largest
  ));
}

export default async function decorate(block) {
  await loadScript(ASSET_SELECTORS_SCRIPT);

  const launchButton = document.createElement('button');
  launchButton.type = 'button';
  launchButton.textContent = 'Select Asset';

  const dialog = document.createElement('dialog');
  dialog.className = 'content-advisor-import-dialog';
  const selectorContainer = document.createElement('div');
  dialog.append(selectorContainer);

  const preview = document.createElement('div');
  preview.className = 'content-advisor-import-preview';
  preview.setAttribute('aria-live', 'polite');

  block.replaceChildren(launchButton, dialog, preview);

  const imsProps = {
    imsClientId: 'aem-assets-frontend-1',
    imsScope: 'AdobeID,openid,additional_info.projectedProductContext,read_organizations',
    redirectUrl: window.location.href,
    modalMode: true,
  };

  const imsInstance = window.PureJSSelectors.registerContentAdvisorAuthService(imsProps);
  let renditionObjectUrl;

  function closeDialog() {
    dialog.close();
  }

  async function handleSelection(selection) {
    const asset = getSelectedAsset(selection);
    if (!asset) {
      preview.textContent = 'No asset was selected.';
      closeDialog();
      return;
    }

    const format = String(asset['dc:format'] || asset.mimetype || '').trim().toLowerCase();
    const mediaType = format.split('/')[0];
    const assetUrl = getAssetUrl(asset, mediaType);
    const rendition = getLargestRendition(asset);
    const name = asset.name || 'Selected asset';

    if (renditionObjectUrl) {
      URL.revokeObjectURL(renditionObjectUrl);
      renditionObjectUrl = null;
    }
    preview.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = name;
    preview.append(heading);

    if (mediaType === 'image' && (assetUrl || rendition?.href)) {
      const image = document.createElement('img');
      image.alt = name;
      image.src = assetUrl || rendition.href;
      let renditionFallbackAttempted = false;
      image.addEventListener('error', async () => {
        if (rendition?.href && !renditionFallbackAttempted) {
          renditionFallbackAttempted = true;
          try {
            const accessToken = await imsInstance.getAccessToken();
            const response = await fetch(rendition.href, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.ok) {
              throw new Error(`Rendition request failed: ${response.status}`);
            }
            renditionObjectUrl = URL.createObjectURL(await response.blob());
            image.src = renditionObjectUrl;
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to load selected asset rendition', error);
            preview.textContent = `Unable to display ${name}.`;
          }
          return;
        }
        preview.textContent = `Unable to display ${name}.`;
      });
      preview.append(image);
    } else if (mediaType === 'video' && assetUrl) {
      const videoPreview = document.createElement('iframe');
      videoPreview.src = assetUrl;
      videoPreview.title = name;
      videoPreview.allowFullscreen = true;
      preview.append(videoPreview);
    } else if (format === 'application/pdf' && assetUrl) {
      const documentPreview = document.createElement('iframe');
      documentPreview.src = assetUrl;
      documentPreview.title = name;
      preview.append(documentPreview);
    } else if (assetUrl) {
      const link = document.createElement('a');
      link.href = assetUrl;
      link.textContent = `Open ${name}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      preview.append(link);
    } else if (rendition?.href) {
      const image = document.createElement('img');
      image.src = rendition.href;
      image.alt = name;
      preview.append(image);
    } else {
      preview.textContent = `Unable to display ${name}: the selected asset has no usable delivery URL.`;
    }

    closeDialog();
  }

  launchButton.addEventListener('click', () => {
    const container = document.createElement('div');
    selectorContainer.replaceChildren(container);
    window.PureJSSelectors.renderContentAdvisorWithAuthFlow(container, {
      onClose: closeDialog,
      handleSelection,
      imsOrg: 'aem-assets-frontend-1',
      aemTierType: ['delivery', 'author'],
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    }, () => dialog.showModal());
  });
}
