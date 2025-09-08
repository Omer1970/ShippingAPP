<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Support\Facades\Hash;

trait CreatesApplication
{
    /**
     * Creates the application.
     *
     * @return \Illuminate\Foundation\Application
     */
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';

        $app->make(ConsoleKernel::class)->bootstrap();

        Hash::driver('bcrypt')->setRounds(4); // Speed up tests

        return $app;
    }
}