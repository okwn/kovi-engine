INSERT INTO sources (id, name, adapter_type, config_json, active)
VALUES
  (
    gen_random_uuid(),
    'Static Catalog Example',
    'static-catalog',
    jsonb_build_object(
      'baseUrl', 'https://example-catalog.local',
      'crawlEntrypoints', jsonb_build_array('https://example-catalog.local/catalog'),
      'allowedDomains', jsonb_build_array('example-catalog.local'),
      'internalLinkPatterns', jsonb_build_array('https://example-catalog.local/catalog*', 'https://example-catalog.local/item/*'),
      'extractionSelectors', jsonb_build_object(
        'listing', jsonb_build_array(
          jsonb_build_object('key','id','selector','[data-item-id]','attribute','data-item-id','required',true),
          jsonb_build_object('key','name','selector','.item-name','required',true),
          jsonb_build_object('key','price','selector','.item-price','required',false)
        ),
        'detail', jsonb_build_array(
          jsonb_build_object('key','id','selector','[data-item-id]','attribute','data-item-id','required',true),
          jsonb_build_object('key','description','selector','.item-description','required',false)
        )
      ),
      'pagination', jsonb_build_object('mode','next-link','nextSelector','.next-page','maxPages',20),
      'authentication', jsonb_build_object('type','manual-cookie-import','renewalSeconds',3600),
      'scheduleInterval', 'PT15M',
      'changeDetection', jsonb_build_object('ignoredFields',jsonb_build_array(),'logicalDeleteAfterMisses',3),
      'exportPolicy', jsonb_build_object('subject','kovi.source.static-catalog.changed','includeRawMetadata',false),
      'maxDepth', 2,
      'fetchMode', 'static',
      'aiFallbackEnabled', false
    ),
    true
  ),
  (
    gen_random_uuid(),
    'JS Listing Detail Example',
    'js-listing-detail',
    jsonb_build_object(
      'baseUrl', 'https://example-js.local',
      'crawlEntrypoints', jsonb_build_array('https://example-js.local/listings'),
      'allowedDomains', jsonb_build_array('example-js.local'),
      'internalLinkPatterns', jsonb_build_array('https://example-js.local/listings*', 'https://example-js.local/detail/*'),
      'extractionSelectors', jsonb_build_object(
        'listing', jsonb_build_array(
          jsonb_build_object('key','id','selector','[data-id]','attribute','data-id','required',true),
          jsonb_build_object('key','title','selector','.title','required',true)
        ),
        'detail', jsonb_build_array(
          jsonb_build_object('key','id','selector','[data-id]','attribute','data-id','required',true),
          jsonb_build_object('key','features','selector','.feature','required',false,'multiple',true)
        )
      ),
      'pagination', jsonb_build_object('mode','next-link','nextSelector','button.next','maxPages',25),
      'authentication', jsonb_build_object('type','header-token-injection','headerName','Authorization','tokenSecretRef','dashboard_api_token','prefix','Bearer','renewalSeconds',1800),
      'scheduleInterval', 'PT10M',
      'changeDetection', jsonb_build_object('ignoredFields',jsonb_build_array('last_seen'),'logicalDeleteAfterMisses',2),
      'exportPolicy', jsonb_build_object('subject','kovi.source.js-listing.changed','includeRawMetadata',false),
      'maxDepth', 3,
      'fetchMode', 'js',
      'aiFallbackEnabled', true
    ),
    true
  ),
  (
    gen_random_uuid(),
    'Authenticated Dashboard Example',
    'auth-dashboard',
    jsonb_build_object(
      'baseUrl', 'https://example-dashboard.local',
      'crawlEntrypoints', jsonb_build_array('https://example-dashboard.local/dashboard'),
      'allowedDomains', jsonb_build_array('example-dashboard.local'),
      'internalLinkPatterns', jsonb_build_array('https://example-dashboard.local/dashboard*', 'https://example-dashboard.local/account/*'),
      'extractionSelectors', jsonb_build_object(
        'listing', jsonb_build_array(
          jsonb_build_object('key','account_id','selector','[data-account-id]','attribute','data-account-id','required',true),
          jsonb_build_object('key','balance','selector','.balance','required',false)
        ),
        'detail', jsonb_build_array(
          jsonb_build_object('key','account_id','selector','[data-account-id]','attribute','data-account-id','required',true),
          jsonb_build_object('key','owner','selector','.owner-name','required',false)
        )
      ),
      'pagination', jsonb_build_object('mode','none'),
      'authentication', jsonb_build_object(
        'type','playwright-form-login',
        'loginUrl','https://example-dashboard.local/login',
        'usernameSelector','#username',
        'passwordSelector','#password',
        'submitSelector','button[type=submit]',
        'successSelector','[data-dashboard-root]',
        'usernameSecretRef','dashboard_username',
        'passwordSecretRef','dashboard_password',
        'renewalSeconds',1800
      ),
      'scheduleInterval', 'PT5M',
      'changeDetection', jsonb_build_object('ignoredFields',jsonb_build_array(),'logicalDeleteAfterMisses',1),
      'exportPolicy', jsonb_build_object('subject','kovi.source.auth-dashboard.changed','includeRawMetadata',true),
      'maxDepth', 2,
      'fetchMode', 'js',
      'aiFallbackEnabled', false
    ),
    true
  );
