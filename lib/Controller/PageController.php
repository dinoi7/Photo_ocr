<?php

declare(strict_types=1);

namespace OCA\PhotoOcr\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;

class PageController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
	) {
		parent::__construct($appName, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		$response = new TemplateResponse('photo_ocr', 'index');

		$csp = new ContentSecurityPolicy();
		// Tesseract.js kompiliert WebAssembly im Browser, daher muss
		// "wasm-unsafe-eval" fuer diese Seite erlaubt werden.
		$csp->allowEvalWasm(true);
		$csp->addAllowedWorkerSrcDomain("'self'");
		$response->setContentSecurityPolicy($csp);

		return $response;
	}
}
